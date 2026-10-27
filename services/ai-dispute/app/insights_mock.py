"""Deterministic admin marketplace insights for tests / no-key mode."""
from .schemas import InsightBullet, InsightsResult


def build_insights(stats: dict) -> InsightsResult:
    s = stats or {}
    open_disputes = int(s.get("openDisputes") or 0)
    open_flags = int(s.get("openRiskFlags") or 0)
    ai_support = int(s.get("aiEscalatedTickets") or 0)
    orders_7d = int(s.get("ordersLast7d") or 0)
    bullets = []
    if open_disputes:
        bullets.append(InsightBullet(title="Open disputes", detail=f"{open_disputes} dispute(s) still need a human decision.", tone="warn"))
    else:
        bullets.append(InsightBullet(title="Disputes quiet", detail="No open disputes right now.", tone="ok"))
    if open_flags:
        bullets.append(InsightBullet(title="Risk queue", detail=f"{open_flags} open risk flag(s) — review pay-outside / contact hits before they age.", tone="warn"))
    else:
        bullets.append(InsightBullet(title="Risk queue clear", detail="No open risk flags.", tone="ok"))
    if ai_support:
        bullets.append(InsightBullet(title="Support escalations", detail=f"{ai_support} AI-escalated ticket(s) waiting on admin.", tone="warn"))
    bullets.append(InsightBullet(title="Orders (7d)", detail=f"{orders_7d} order(s) created in the last 7 days.", tone="info"))
    summary = (
        f"Trust queue: {open_disputes} disputes, {open_flags} risk flags, {ai_support} AI support escalations. "
        "AI does not take actions — use these bullets to prioritize human review."
    )
    return InsightsResult(summary=summary, bullets=bullets[:8], confidence=0.75)
