"""Deterministic fraud / scam second-pass for tests and no-key mode."""
from .schemas import FraudEvidence, FraudReview

OFF_PLATFORM = ("whatsapp", "telegram", "t.me", "wa.me", "signal", "discord.gg", "skype")
PAY_OFF = ("pay outside", "pay me outside", "venmo", "cashapp", "cash app", "paypal.me", "wire transfer", "gift card")
IMPERSONATE = ("i am admin", "i'm admin", "qwlee support", "verify your account", "send password")


def review_fraud(excerpt: str, reasons: list[str] | None = None, kind: str = "message") -> FraudReview:
    text = (excerpt or "").strip()
    tl = text.lower()
    reasons = list(reasons or [])
    evidence: list[FraudEvidence] = []
    labels = []
    conf = 0.4

    if any(k in tl for k in OFF_PLATFORM) or any(str(r).startswith("contact:") for r in reasons):
        labels.append("off_platform_contact")
        evidence.append(FraudEvidence(source="excerpt", quote=text[:160], why="Mentions off-platform messenger or contact details"))
        conf = max(conf, 0.78)

    if any(k in tl for k in PAY_OFF):
        labels.append("off_platform_payment")
        evidence.append(FraudEvidence(source="excerpt", quote=text[:160], why="Asks to pay or move money outside escrow"))
        conf = max(conf, 0.88)

    if any(k in tl for k in IMPERSONATE):
        labels.append("impersonation")
        evidence.append(FraudEvidence(source="excerpt", quote=text[:160], why="Looks like staff/admin impersonation"))
        conf = max(conf, 0.9)

    if any(str(r).startswith("keyword:") for r in reasons) and not labels:
        labels.append("policy_keyword")
        evidence.append(FraudEvidence(source="rules", quote=", ".join(reasons)[:160], why="Keyword filter hit"))
        conf = max(conf, 0.65)

    if any(r in ("new-account-large-order", "order-burst") for r in reasons):
        labels.append("order_risk")
        evidence.append(FraudEvidence(source="rules", quote=", ".join(reasons), why="New account or burst order rule"))
        conf = max(conf, 0.7)

    if not labels:
        labels.append("unclear")
        conf = 0.35
        evidence.append(FraudEvidence(source="excerpt", quote=text[:120] or "(empty)", why="No strong scam pattern; keep open for a human"))

    label = labels[0]
    rationale = (
        f"Rules/LLM second pass on a {kind}: likely {label.replace('_', ' ')}. "
        "Do not auto-ban — a moderator should review the evidence."
    )
    return FraudReview(
        label=label,
        confidence=conf,
        rationale=rationale,
        evidence=evidence[:5],
        recommendAction="review",  # never auto-ban
    )
