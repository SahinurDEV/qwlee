from app.mock import suggest
from app.schemas import Suggestion
from app.llm import coerce_llm_payload, _sanitize


def test_no_delivery_full_refund():
    ctx = {
        "dispute": {"reasonCode": "no_delivery", "description": "Never delivered", "responses": []},
        "order": {"price": 100, "events": []},
        "gig": {"title": "Logo design"},
        "chat": [{"id": "chat.msg:1", "text": "Still waiting for delivery"}],
        "policyChunks": [{"id": "policy:refund§5", "heading": "Disputes", "text": "Our team reviews…"}],
    }
    s = suggest(ctx)
    assert s.outcome == "full_refund"
    assert s.confidence >= 0.7
    assert s.evidence


def test_suggestion_accepts_null_draft_ask_more_info():
    """Regression: OpenRouter often returns draftAskMoreInfo: null for partial_refund.
    That must not raise ValidationError (which used to force mock-fallback)."""
    payload = {
        "outcome": "partial_refund",
        "confidence": 0.9,
        "rationale": "Buyer got logo only; brand kit missing.",
        "partial": {"amount": 50, "percent": 50, "note": None},
        "draftNoteToParties": None,
        "draftAskMoreInfo": None,
        "evidence": [
            {"source": "dispute.response[0]", "quote": "Where is the brand kit?", "why": None},
        ],
    }
    coerced = coerce_llm_payload(payload)
    s = Suggestion.model_validate(coerced)
    assert s.outcome == "partial_refund"
    assert s.draftAskMoreInfo == ""
    assert s.draftNoteToParties == ""
    assert s.partial is not None and s.partial.note == ""
    assert s.evidence[0].why == ""


def test_suggestion_schema_alone_coerces_null_strings():
    """Schema-level before validators also accept null without coerce helper."""
    s = Suggestion.model_validate(
        {
            "outcome": "ask_for_more_info",
            "confidence": 0.4,
            "rationale": None,
            "draftAskMoreInfo": None,
            "draftNoteToParties": None,
            "evidence": [],
        }
    )
    assert s.rationale == ""
    assert s.draftAskMoreInfo == ""


def test_sanitize_keeps_valid_citations_after_null_coerce():
    ctx = {
        "dispute": {"responses": [{"id": "dispute.response[0]"}]},
        "order": {"events": [{"id": "order.event:created"}], "price": 100},
        "chat": [],
        "policyChunks": [],
        "gig": {},
    }
    payload = coerce_llm_payload(
        {
            "outcome": "partial_refund",
            "confidence": 0.85,
            "rationale": "Incomplete delivery",
            "partial": {"amount": 50, "percent": 50, "note": None},
            "draftAskMoreInfo": None,
            "draftNoteToParties": "Partial refund of $50.",
            "evidence": [
                {"source": "dispute.response[0]", "quote": "Where is the brand kit?", "why": "Buyer"},
                {"source": "invented.source", "quote": "nope", "why": "drop me"},
            ],
        }
    )
    s = _sanitize(Suggestion.model_validate(payload), ctx)
    assert [e.source for e in s.evidence] == ["dispute.response[0]"]


def test_support_mock_refund_keywords():
    from app.support_mock import answer_support
    chunks = [{"id": "policy:refund§5", "doc": "refund", "heading": "Disputes", "text": "Our team reviews refund requests within a few days."}]
    s = answer_support("How do I get a refund for a late delivery?", chunks)
    assert s.confidence >= 0.7
    assert s.citations
    assert s.citations[0].source.startswith("policy:refund")
    assert s.escalate is False


def test_support_mock_escalates_when_thin():
    from app.support_mock import answer_support
    s = answer_support("xyzzy unexplained purple widgets?", [])
    assert s.escalate is True
    assert s.confidence < 0.55


def test_search_mock_logo_under_50():
    from app.search_mock import parse_search
    p = parse_search("logo for my bakery under $50", ["Graphic Design", "Web Development"])
    assert p.categoryHint == "Graphic Design"
    assert p.maxPrice == 50
    assert "logo" in p.keywords


def test_parse_search_maps_logo_to_graphic():
    from app.search_mock import parse_search
    p = parse_search("logo design under $40", ["Graphic Design", "Web Development", "UI/UX Design"])
    assert p.categoryHint == "Graphic Design"
    assert p.maxPrice == 40
    assert "AI understood" in p.explanation


def test_fraud_mock_off_platform_pay():
    from app.fraud_mock import review_fraud
    r = review_fraud("Pay me on Venmo outside the platform please", ["contact:messenger"], "message")
    assert r.label in ("off_platform_payment", "off_platform_contact")
    assert r.recommendAction == "review"
    assert r.confidence >= 0.7


def test_fraud_mock_unclear():
    from app.fraud_mock import review_fraud
    r = review_fraud("Thanks for the delivery!", [], "message")
    assert r.label == "unclear"
    assert r.recommendAction == "review"


def test_insights_mock_warns_on_open_queues():
    from app.insights_mock import build_insights
    r = build_insights({"openDisputes": 2, "openRiskFlags": 3, "aiEscalatedTickets": 1, "ordersLast7d": 10})
    assert r.bullets
    assert r.confidence >= 0.5
    assert "dispute" in r.summary.lower() or "Trust" in r.summary
