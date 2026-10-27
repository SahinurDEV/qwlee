"""Deterministic support Q&A for tests and when no API key is set."""
from .schemas import SupportAnswer, SupportCitation

KEYWORDS = [
    (("refund", "cancel", "money back"), "policy:refund", "Refunds", 0.82, False),
    (("payment", "stripe", "card", "payout"), "policy:payment-terms", "Payments", 0.8, False),
    (("harass", "abuse", "scam", "off-platform", "whatsapp"), "policy:community-standards", "Trust & safety", 0.78, False),
    (("copyright", "ip", "trademark", "dmca"), "policy:intellectual-property", "IP", 0.8, False),
    (("terms", "account", "ban"), "policy:terms-excerpt", "Terms", 0.7, False),
]


def answer_support(question: str, chunks: list[dict]) -> SupportAnswer:
    q = (question or "").lower()
    by_doc = {}
    for c in chunks or []:
        doc = (c.get("doc") or (c.get("id") or "").split(":")[-1].split("§")[0] or "").strip()
        by_doc.setdefault(doc, c)

    for keys, doc_prefix, label, conf, esc in KEYWORDS:
        if any(k in q for k in keys):
            chunk = None
            for c in chunks or []:
                if str(c.get("id", "")).startswith(doc_prefix) or c.get("doc") in doc_prefix:
                    chunk = c
                    break
            if not chunk and chunks:
                chunk = chunks[0]
            cite_id = (chunk or {}).get("id") or f"{doc_prefix}§1"
            quote = ((chunk or {}).get("text") or (chunk or {}).get("heading") or label)[:180]
            return SupportAnswer(
                answer=f"Based on our {label} policy: {quote[:140]}… If that does not cover your case, ask to talk to a human.",
                confidence=conf,
                citations=[SupportCitation(source=cite_id, quote=quote, why=f"Matched {label} keywords")],
                escalate=esc,
                draftTicketSubject="",
                draftTicketBody="",
            )

    # Thin evidence → escalate
    chunk = (chunks or [None])[0]
    cite = []
    if chunk:
        cite = [SupportCitation(source=chunk.get("id") or "policy:terms-excerpt§1", quote=(chunk.get("text") or "")[:160], why="Best available policy snippet")]
    return SupportAnswer(
        answer="I am not confident enough to answer from the published policies alone. I can open a ticket so a human admin can help.",
        confidence=0.35,
        citations=cite,
        escalate=True,
        draftTicketSubject=(question or "Support question")[:120],
        draftTicketBody=f"User asked: {question}\n\nAI was below the confidence threshold and requested a human.",
    )
