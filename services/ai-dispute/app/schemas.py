from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator

Outcome = Literal[
    "full_refund",
    "partial_refund",
    "release_to_seller",
    "mutual_cancellation",
    "ask_for_more_info",
]


def _null_to_str(v: Any) -> str:
    """OpenRouter often returns JSON null for unused string fields."""
    if v is None:
        return ""
    return v if isinstance(v, str) else str(v)


class Evidence(BaseModel):
    source: str
    quote: str
    why: str = ""

    @field_validator("source", "quote", "why", mode="before")
    @classmethod
    def coerce_str(cls, v: Any) -> str:
        return _null_to_str(v)


class Partial(BaseModel):
    amount: Optional[float] = None
    percent: Optional[float] = None
    note: str = ""

    @field_validator("note", mode="before")
    @classmethod
    def coerce_note(cls, v: Any) -> str:
        return _null_to_str(v)


class Suggestion(BaseModel):
    outcome: Outcome
    confidence: float = Field(ge=0, le=1)
    rationale: str
    partial: Optional[Partial] = None
    draftNoteToParties: str = ""
    draftAskMoreInfo: str = ""
    evidence: list[Evidence] = Field(default_factory=list)

    @field_validator("rationale", "draftNoteToParties", "draftAskMoreInfo", mode="before")
    @classmethod
    def coerce_str(cls, v: Any) -> str:
        return _null_to_str(v)

    @field_validator("confidence")
    @classmethod
    def clamp_conf(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))


class SuggestRequest(BaseModel):
    context: dict[str, Any]
    mock: bool = False


class SuggestResponse(BaseModel):
    suggestion: Suggestion
    source: Literal["remote", "mock"]
    model: str = ""
    latencyMs: int = 0
    configured: bool = True
