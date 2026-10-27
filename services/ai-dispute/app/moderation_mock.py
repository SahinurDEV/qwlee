"""Heuristic / mock moderation when OpenRouter is not configured."""
import re

PATTERNS = [
    ("contact:email", re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)),
    ("contact:phone", re.compile(r"(?<!\w)(?:\+?\d[\s().-]?){9,}\d(?!\w)")),
    ("contact:messenger", re.compile(r"\b(whats\s?app|telegram|t\.me/|wa\.me/|skype)\b", re.I)),
    ("contact:payment", re.compile(r"\b(paypal\.me|venmo|cash\s*app|zelle|bank\s*transfer)\b", re.I)),
    ("contact:offplatform", re.compile(r"\b(let'?s\s+(move|talk)\s+(off|outside)|outside\s+the\s+platform)\b", re.I)),
    ("contact:obfuscated-email", re.compile(r"\b[\w.+-]+\s*(?:at|@)\s*[\w-]+\s*(?:dot|\.)\s*(?:com|net|org)\b", re.I)),
]


def moderate(text: str, heuristic: dict | None = None) -> dict:
    reasons = list((heuristic or {}).get("reasons") or [])
    for r, re_ in PATTERNS:
        if re_.search(text or "") and r not in reasons:
            reasons.append(r)
    score = float((heuristic or {}).get("score") or len(reasons))
    summary = ""
    if reasons:
        summary = "Possible off-platform or contact sharing detected: " + ", ".join(reasons[:5])
    return {"reasons": reasons, "score": max(score, float(len(reasons))), "summary": summary}
