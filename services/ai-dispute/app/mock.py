"""Deterministic mock suggester for tests and when no API key is set."""
from .schemas import Evidence, Partial, Suggestion


def suggest(context: dict) -> Suggestion:
    d = context.get("dispute") or {}
    reason = (d.get("reasonCode") or "other").lower()
    chat = context.get("chat") or []
    policies = context.get("policyChunks") or []
    order = context.get("order") or {}
    gig = context.get("gig") or {}

    def cite_chat(substr: str):
        for m in chat:
            if substr.lower() in (m.get("text") or "").lower():
                return Evidence(source=m["id"], quote=(m.get("text") or "")[:180], why="Order chat")
        if chat:
            m = chat[-1]
            return Evidence(source=m["id"], quote=(m.get("text") or "")[:180], why="Recent chat")
        return None

    def cite_policy(prefer: str):
        for p in policies:
            if prefer in (p.get("id") or "") or prefer in (p.get("heading") or "").lower():
                return Evidence(source=p["id"], quote=(p.get("text") or "")[:180], why="Policy")
        if policies:
            p = policies[0]
            return Evidence(source=p["id"], quote=(p.get("text") or "")[:180], why="Policy")
        return Evidence(source="policy:refund§5", quote="Our team reviews the order chat…", why="Fallback policy")

    evidence: list[Evidence] = []
    c = cite_chat("deliver") or cite_chat("")
    if c:
        evidence.append(c)
    evidence.append(cite_policy("refund"))
    if gig.get("title"):
        evidence.append(Evidence(source="gig.package", quote=str(gig.get("title"))[:180], why="Gig scope"))

    mapping = {
        "no_delivery": ("full_refund", 0.86, "No delivery is evidenced; full refund is appropriate."),
        "late_delivery": ("partial_refund", 0.62, "Delivery was late; consider a partial refund."),
        "not_as_described": ("partial_refund", 0.74, "Delivery appears incomplete vs gig description."),
        "low_quality": ("ask_for_more_info", 0.48, "Quality claims need clearer proof before deciding."),
        "buyer_unresponsive": ("release_to_seller", 0.8, "Seller delivered; buyer unresponsive supports release."),
        "scope_creep": ("release_to_seller", 0.7, "Extra work outside package favors the seller."),
        "abusive_behavior": ("ask_for_more_info", 0.55, "Abuse claims need review of exact messages."),
        "other": ("ask_for_more_info", 0.4, "Insufficient signal; ask for more information."),
    }
    outcome, conf, rationale = mapping.get(reason, mapping["other"])

    # Heuristic: if escrow already released events say completed → release
    events = order.get("events") or []
    if any(e.get("name") == "completed" for e in events) and reason in ("late_delivery", "buyer_unresponsive"):
        outcome, conf, rationale = "release_to_seller", 0.82, "Order already completed; release stands unless strong contrary evidence."

    partial = None
    if outcome == "partial_refund":
        price = float(order.get("price") or order.get("escrowAmount") or 0)
        amount = round(price * 0.4, 2) if price else None
        partial = Partial(amount=amount, percent=40, note="Estimated incomplete portion")

    ask = ""
    draft = f"Resolution recommendation: {outcome.replace('_', ' ')}."
    if outcome == "ask_for_more_info":
        ask = (
            "Please reply on this dispute with: (1) the specific files or screenshots that show the problem, "
            "(2) how they differ from the gig package, and (3) what resolution you are asking for."
        )
        draft = ask

    return Suggestion(
        outcome=outcome,
        confidence=conf,
        rationale=rationale,
        partial=partial,
        draftNoteToParties=draft,
        draftAskMoreInfo=ask,
        evidence=evidence[:6],
    )
