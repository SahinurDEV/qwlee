import os
from fastapi import FastAPI, Header, HTTPException
from .llm import complete, complete_support, complete_search_parse, configured
from .schemas import (
    SuggestRequest,
    SuggestResponse,
    SupportAskRequest,
    SupportAskResponse,
    SearchParseRequest,
    SearchParseResponse,
)

app = FastAPI(title="qwlee ai-dispute", version="1.1.0")


def _check_token(token: str | None):
    expected = os.environ.get("AI_DISPUTE_TOKEN", "")
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {
        "ok": True,
        "configured": configured(),
        "model": os.environ.get("AI_MODEL") or "",
        "provider": "openrouter" if "openrouter.ai" in (os.environ.get("AI_API_URL") or "") else "openai-compatible",
    }


@app.post("/v1/suggest", response_model=SuggestResponse)
async def suggest(req: SuggestRequest, x_internal_token: str | None = Header(default=None)):
    _check_token(x_internal_token)
    if not configured() and not req.mock:
        raise HTTPException(
            status_code=503,
            detail="AI not configured. Set AI_API_URL, AI_API_KEY and AI_MODEL (OpenRouter by default).",
        )
    suggestion, source, model, latency = await complete(req.context, force_mock=req.mock)
    return SuggestResponse(
        suggestion=suggestion,
        source=source,
        model=model,
        latencyMs=latency,
        configured=configured(),
    )


@app.post("/v1/support-answer", response_model=SupportAskResponse)
async def support_answer(req: SupportAskRequest, x_internal_token: str | None = Header(default=None)):
    _check_token(x_internal_token)
    q = (req.question or "").strip()
    if len(q) < 5:
        raise HTTPException(status_code=400, detail="Question is too short")
    if not configured() and not req.mock:
        raise HTTPException(
            status_code=503,
            detail="AI not configured. Set AI_API_URL, AI_API_KEY and AI_MODEL (OpenRouter by default).",
        )
    answer, source, model, latency = await complete_support(q, req.policyChunks, force_mock=req.mock)
    return SupportAskResponse(
        answer=answer,
        source=source,
        model=model,
        latencyMs=latency,
        configured=configured(),
    )


@app.post("/v1/search-parse", response_model=SearchParseResponse)
async def search_parse(req: SearchParseRequest, x_internal_token: str | None = Header(default=None)):
    _check_token(x_internal_token)
    q = (req.query or "").strip()
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query is too short")
    if not configured() and not req.mock:
        raise HTTPException(status_code=503, detail="AI not configured")
    parse, source, model, latency = await complete_search_parse(q, req.categories, force_mock=req.mock)
    return SearchParseResponse(parse=parse, source=source, model=model, latencyMs=latency, configured=configured())
