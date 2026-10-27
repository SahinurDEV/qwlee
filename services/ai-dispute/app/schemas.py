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


class SupportCitation(BaseModel):
    source: str
    quote: str
    why: str = ""

    @field_validator("source", "quote", "why", mode="before")
    @classmethod
    def coerce_cite_str(cls, v: Any) -> str:
        return _null_to_str(v)


class SupportAnswer(BaseModel):
    answer: str
    confidence: float = Field(ge=0, le=1)
    citations: list[SupportCitation] = Field(default_factory=list)
    escalate: bool = False
    draftTicketSubject: str = ""
    draftTicketBody: str = ""

    @field_validator("answer", "draftTicketSubject", "draftTicketBody", mode="before")
    @classmethod
    def coerce_ans_str(cls, v: Any) -> str:
        return _null_to_str(v)

    @field_validator("confidence")
    @classmethod
    def clamp_ans_conf(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))


class SupportAskRequest(BaseModel):
    question: str
    audience: Literal["buyer", "seller", "all"] = "all"
    policyChunks: list[dict[str, Any]] = Field(default_factory=list)
    mock: bool = False


class SupportAskResponse(BaseModel):
    answer: SupportAnswer
    source: Literal["remote", "mock"]
    model: str = ""
    latencyMs: int = 0
    configured: bool = True


class SearchParse(BaseModel):
    keywords: str = ""
    categoryHint: str = ""
    maxPrice: Optional[float] = None
    minPrice: Optional[float] = None
    sortBy: str = ""
    explanation: str = ""

    @field_validator("keywords", "categoryHint", "sortBy", "explanation", mode="before")
    @classmethod
    def coerce_search_str(cls, v: Any) -> str:
        return _null_to_str(v)


class SearchParseRequest(BaseModel):
    query: str
    categories: list[str] = Field(default_factory=list)
    mock: bool = False


class SearchParseResponse(BaseModel):
    parse: SearchParse
    source: Literal["remote", "mock"]
    model: str = ""
    latencyMs: int = 0
    configured: bool = True


class FraudEvidence(BaseModel):
    source: str
    quote: str
    why: str = ""

    @field_validator("source", "quote", "why", mode="before")
    @classmethod
    def coerce_fraud_cite(cls, v: Any) -> str:
        return _null_to_str(v)


class FraudReview(BaseModel):
    label: str = "unclear"
    confidence: float = Field(ge=0, le=1)
    rationale: str = ""
    evidence: list[FraudEvidence] = Field(default_factory=list)
    recommendAction: str = "review"  # always review; never auto-ban from AI

    @field_validator("label", "rationale", "recommendAction", mode="before")
    @classmethod
    def coerce_fraud_str(cls, v: Any) -> str:
        return _null_to_str(v)

    @field_validator("confidence")
    @classmethod
    def clamp_fraud_conf(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))


class FraudReviewRequest(BaseModel):
    excerpt: str = ""
    reasons: list[str] = Field(default_factory=list)
    kind: str = "message"
    mock: bool = False


class FraudReviewResponse(BaseModel):
    review: FraudReview
    source: Literal["remote", "mock"]
    model: str = ""
    latencyMs: int = 0
    configured: bool = True


class InsightBullet(BaseModel):
    title: str = ""
    detail: str = ""
    tone: str = "info"  # ok|warn|info

    @field_validator("title", "detail", "tone", mode="before")
    @classmethod
    def coerce_ins(cls, v: Any) -> str:
        return _null_to_str(v)


class InsightsResult(BaseModel):
    summary: str = ""
    bullets: list[InsightBullet] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, default=0.7)

    @field_validator("summary", mode="before")
    @classmethod
    def coerce_sum(cls, v: Any) -> str:
        return _null_to_str(v)

    @field_validator("confidence")
    @classmethod
    def clamp_ins(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))


class InsightsRequest(BaseModel):
    stats: dict[str, Any] = Field(default_factory=dict)
    mock: bool = False


class InsightsResponse(BaseModel):
    insights: InsightsResult
    source: Literal["remote", "mock"]
    model: str = ""
    latencyMs: int = 0
    configured: bool = True
