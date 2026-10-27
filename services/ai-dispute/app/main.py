import os
from fastapi import FastAPI, Header, HTTPException
from .llm import complete, configured
from .schemas import SuggestRequest, SuggestResponse

app = FastAPI(title="qwlee ai-dispute", version="1.0.0")


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
        # Explicit unconfigured state — caller may still pass mock=true for demos/tests.
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
