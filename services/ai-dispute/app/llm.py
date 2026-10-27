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


def coerce_llm_payload(parsed: Any) -> Any:
    """Normalize LLM JSON so Pydantic never sees null for string fields.

    Models frequently emit `"draftAskMoreInfo": null` when the outcome is not
    ask_for_more_info; without this, ValidationError triggers mock-fallback.
    """
    if not isinstance(parsed, dict):
        return parsed
    for k in ("draftAskMoreInfo", "draftNoteToParties", "rationale"):
        if parsed.get(k) is None:
            parsed[k] = ""
    partial = parsed.get("partial")
    if isinstance(partial, dict) and partial.get("note") is None:
        partial["note"] = ""
    for e in parsed.get("evidence") or []:
        if isinstance(e, dict):
            for k in ("source", "quote", "why"):
                if e.get(k) is None:
                    e[k] = ""
    return parsed


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
        parsed: Any = coerce_llm_payload(json.loads(content))
        s = _sanitize(Suggestion.model_validate(parsed), context)
        return s, "remote", model, int((time.time() - t0) * 1000)
    except Exception:
        s = _sanitize(mock_suggest(context), context)
        return s, "mock", "mock-fallback", int((time.time() - t0) * 1000)


SUPPORT_SYSTEM = """You are qwlee Help Centre. Answer ONLY from the provided policy chunks.
Return ONLY JSON:
{"answer":"...","confidence":0-1,"citations":[{"source":"policy:doc§n","quote":"...","why":"..."}],"escalate":false,"draftTicketSubject":"","draftTicketBody":""}
Cite only chunk IDs present in the prompt. If unsure, set confidence < 0.55 and escalate=true with a short draftTicketSubject/Body for a human admin. Never invent policy text. Never ask for passwords or payment details.
"""


def _sanitize_support(ans: "SupportAnswer", chunks: list) -> "SupportAnswer":
    from .schemas import SupportAnswer  # noqa: F811
    allowed = {c.get("id") for c in (chunks or []) if c.get("id")}
    ans.citations = [c for c in ans.citations if c.source in allowed] if allowed else ans.citations
    if ans.confidence < 0.55:
        ans.escalate = True
    return ans


async def complete_support(question: str, chunks: list, *, force_mock: bool = False):
    from .schemas import SupportAnswer
    from .support_mock import answer_support
    t0 = time.time()
    if force_mock or not configured():
        s = _sanitize_support(answer_support(question, chunks), chunks)
        return s, "mock", "mock", int((time.time() - t0) * 1000)

    url = os.environ["AI_API_URL"]
    key = os.environ["AI_API_KEY"]
    model = os.environ.get("AI_MODEL") or "openai/gpt-4o-mini"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_HTTP_REFERER", "https://qwlee.local"),
        "X-Title": os.environ.get("OPENROUTER_X_TITLE", "Qwlee Support Assistant"),
    }
    body = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 700,
        "messages": [
            {"role": "system", "content": SUPPORT_SYSTEM},
            {"role": "user", "content": json.dumps({"question": question, "policyChunks": chunks}, ensure_ascii=False)[:20000]},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        parsed = coerce_llm_payload(json.loads(content))
        if isinstance(parsed, dict):
            for k in ("answer", "draftTicketSubject", "draftTicketBody"):
                if parsed.get(k) is None:
                    parsed[k] = ""
            for e in parsed.get("citations") or []:
                if isinstance(e, dict):
                    for k in ("source", "quote", "why"):
                        if e.get(k) is None:
                            e[k] = ""
        s = _sanitize_support(SupportAnswer.model_validate(parsed), chunks)
        return s, "remote", model, int((time.time() - t0) * 1000)
    except Exception:
        s = _sanitize_support(answer_support(question, chunks), chunks)
        return s, "mock", "mock-fallback", int((time.time() - t0) * 1000)


SEARCH_SYSTEM = """Parse a marketplace search query into JSON filters only:
{"keywords":"...","categoryHint":"","maxPrice":null,"minPrice":null,"sortBy":"","explanation":"..."}
categoryHint must be empty or one of the provided catalogue names. keywords are short search terms. Never invent categories.
"""


async def complete_search_parse(query: str, categories: list, *, force_mock: bool = False):
    from .schemas import SearchParse
    from .search_mock import parse_search
    t0 = time.time()
    if force_mock or not configured():
        return parse_search(query, categories), "mock", "mock", int((time.time() - t0) * 1000)
    url = os.environ["AI_API_URL"]
    key = os.environ["AI_API_KEY"]
    model = os.environ.get("AI_MODEL") or "openai/gpt-4o-mini"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_HTTP_REFERER", "https://qwlee.local"),
        "X-Title": os.environ.get("OPENROUTER_X_TITLE", "Qwlee Search Parser"),
    }
    body = {
        "model": model,
        "temperature": 0,
        "max_tokens": 300,
        "messages": [
            {"role": "system", "content": SEARCH_SYSTEM},
            {"role": "user", "content": json.dumps({"query": query, "categories": categories})},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        parsed = coerce_llm_payload(json.loads(content))
        s = SearchParse.model_validate(parsed)
        if s.categoryHint and categories and s.categoryHint not in categories:
            hint = s.categoryHint.lower()
            # Prefer catalogue names that share a meaningful token (e.g. "Logo Design" → "Graphic Design")
            hit = next((c for c in categories if hint == c.lower() or hint in c.lower() or c.lower() in hint), "")
            if not hit:
                # Fall back to deterministic mock category from the raw query
                hit = parse_search(query, categories).categoryHint
            s.categoryHint = hit if hit in (categories or [hit]) else hit
        # Always give the UI a human-readable explanation
        if not (s.explanation or "").strip():
            s.explanation = parse_search(query, categories).explanation
        return s, "remote", model, int((time.time() - t0) * 1000)
    except Exception:
        return parse_search(query, categories), "mock", "mock-fallback", int((time.time() - t0) * 1000)


FRAUD_SYSTEM = """You are a marketplace trust-and-safety reviewer. Given a flagged chat/gig/order excerpt and rule reasons, return ONLY JSON:
{"label":"off_platform_contact|off_platform_payment|impersonation|policy_keyword|order_risk|unclear","confidence":0-1,"rationale":"...","evidence":[{"source":"excerpt|rules","quote":"...","why":"..."}],"recommendAction":"review"}
Never recommend ban or auto-action. recommendAction must always be "review". Quote only from the provided excerpt/reasons. If unsure, label=unclear and confidence < 0.5.
"""


async def complete_fraud_review(excerpt: str, reasons: list, kind: str = "message", *, force_mock: bool = False):
    from .schemas import FraudReview
    from .fraud_mock import review_fraud
    t0 = time.time()
    if force_mock or not configured():
        return review_fraud(excerpt, reasons, kind), "mock", "mock", int((time.time() - t0) * 1000)
    url = os.environ["AI_API_URL"]
    key = os.environ["AI_API_KEY"]
    model = os.environ.get("AI_MODEL") or "openai/gpt-4o-mini"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_HTTP_REFERER", "https://qwlee.local"),
        "X-Title": os.environ.get("OPENROUTER_X_TITLE", "Qwlee Fraud Review"),
    }
    body = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": FRAUD_SYSTEM},
            {"role": "user", "content": json.dumps({"excerpt": excerpt, "reasons": reasons, "kind": kind}, ensure_ascii=False)[:12000]},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        parsed = coerce_llm_payload(json.loads(content))
        if isinstance(parsed, dict):
            for k in ("label", "rationale", "recommendAction"):
                if parsed.get(k) is None:
                    parsed[k] = ""
            for e in parsed.get("evidence") or []:
                if isinstance(e, dict):
                    for k in ("source", "quote", "why"):
                        if e.get(k) is None:
                            e[k] = ""
            # Hard rule: AI never auto-bans
            parsed["recommendAction"] = "review"
        s = FraudReview.model_validate(parsed)
        s.recommendAction = "review"
        return s, "remote", model, int((time.time() - t0) * 1000)
    except Exception:
        return review_fraud(excerpt, reasons, kind), "mock", "mock-fallback", int((time.time() - t0) * 1000)
