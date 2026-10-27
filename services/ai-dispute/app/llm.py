import json
import os
import time
from typing import Any

import httpx

from .mock import suggest as mock_suggest
from .schemas import Suggestion

SYSTEM = """You are a qwlee trust-and-safety assistant. Recommend ONE outcome for a marketplace dispute.
Allowed outcomes: full_refund, partial_refund, release_to_seller, mutual_cancellation, ask_for_more_info.
Quote ONLY from the provided evidence (chat.msg:*, dispute.response[*], order.event:*, gig.package, policy:*§*).
Never invent messages, dates, or policy text. If evidence is thin, choose ask_for_more_info.
You do NOT execute refunds. Return ONLY valid JSON matching the schema:
{"outcome":"...","confidence":0-1,"rationale":"...","partial":{"amount":number|null,"percent":number|null,"note":"..."}|null,"draftNoteToParties":"...","draftAskMoreInfo":"...","evidence":[{"source":"...","quote":"...","why":"..."}]}
For ask_for_more_info fill draftAskMoreInfo with a short message the admin can copy. For partial_refund set partial.amount when order price is known.
"""


def configured() -> bool:
    return bool(os.environ.get("AI_API_KEY") and os.environ.get("AI_API_URL"))


def _allowed_sources(context: dict) -> set[str]:
    allowed = {"gig.package"}
    for m in context.get("chat") or []:
        if m.get("id"):
            allowed.add(m["id"])
    for r in (context.get("dispute") or {}).get("responses") or []:
        if r.get("id"):
            allowed.add(r["id"])
    for e in (context.get("order") or {}).get("events") or []:
        if e.get("id"):
            allowed.add(e["id"])
    for p in context.get("policyChunks") or []:
        if p.get("id"):
            allowed.add(p["id"])
    return allowed


def _sanitize(s: Suggestion, context: dict) -> Suggestion:
    allowed = _allowed_sources(context)
    s.evidence = [e for e in s.evidence if e.source in allowed]
    if s.outcome == "partial_refund" and s.partial and s.partial.amount is None:
        price = (context.get("order") or {}).get("price") or (context.get("order") or {}).get("escrowAmount")
        if price and s.partial.percent:
            s.partial.amount = round(float(price) * float(s.partial.percent) / 100.0, 2)
    return s


async def complete(context: dict, *, force_mock: bool = False) -> tuple[Suggestion, str, str, int]:
    """Returns suggestion, source, model, latencyMs."""
    t0 = time.time()
    if force_mock or not configured():
        s = _sanitize(mock_suggest(context), context)
        return s, "mock", "mock", int((time.time() - t0) * 1000)

    url = os.environ["AI_API_URL"]
    key = os.environ["AI_API_KEY"]
    model = os.environ.get("AI_MODEL") or "openai/gpt-4o-mini"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_HTTP_REFERER", "https://qwlee.local"),
        "X-Title": os.environ.get("OPENROUTER_X_TITLE", "Qwlee Dispute Assistant"),
    }
    # Compact context for the prompt
    payload_ctx = {
        "dispute": context.get("dispute"),
        "order": context.get("order"),
        "gig": context.get("gig"),
        "parties": context.get("parties"),
        "chat": context.get("chat"),
        "policyChunks": context.get("policyChunks"),
        "allowedOutcomes": context.get("allowedOutcomes"),
    }
    body = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 900,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(payload_ctx, ensure_ascii=False)[:24000]},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        # Strip markdown fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        parsed: Any = json.loads(content)
        s = _sanitize(Suggestion.model_validate(parsed), context)
        return s, "remote", model, int((time.time() - t0) * 1000)
    except Exception:
        s = _sanitize(mock_suggest(context), context)
        return s, "mock", "mock-fallback", int((time.time() - t0) * 1000)
