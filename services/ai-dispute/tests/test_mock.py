from app.mock import suggest

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
