# Admin panel — ideas beyond what is built

What exists today: role-based admins (super / moderator / support / finance),
audit log of every admin request, user/gig/order/escrow/withdrawal/dispute
control, moderation, site settings, broadcasts, analytics. Ideas, roughly by
value:

## Security
- **2FA for admin accounts** (TOTP), required for `super` and `finance`.
- **Approval for big money actions**: refunds/withdrawals over a set amount need a second admin.
- **Admin session list**: see active sessions, revoke one; IP allowlist option.
- **Audit log export** (CSV) and retention setting; alert on repeated denied actions.
- **Custom roles**: build roles from individual permissions in the UI instead of the 4 fixed roles.

## Money
- **Real Stripe refunds** from the admin refund button (today it updates the DB only; refund in Stripe by hand).
- **Payout batches**: approve many withdrawals at once, export a bank file.
- **Fee rules per category or seller level**, promo fee periods.
- **Reconciliation report**: Stripe balance vs. escrow totals, flag mismatches.
- **Coupons / promo codes** for buyers.

## Trust & safety
- **Risk flags**: new account + high-value order, many cancellations, chat messages with emails/phones (off-platform deals).
- **Keyword filters** for gigs, requests and chat, with a review queue.
- **Bulk actions** on users/gigs (ban, unpublish, feature) with reason.
- **Ban appeals inbox** and ban expiry (temporary bans).
- **Make ID documents private** (signed, expiring URLs instead of public random URLs).
- **Delete removed images from storage** (orphan cleanup job).

## Content & communication
- **Per-template email editor** (subject + body with variables, preview, test send). Today only branding/footer is editable.
- **Scheduled announcements** and targeting by country/seller level; in-app banner per audience.
- **Homepage builder**: pick featured categories, gig rails, banners with start/end dates.
- **Help center / FAQ editor**; canned replies for support tickets.
- **Multi-language strings** for the site.

## Insight
- **Funnels**: visit → sign-up → first order; seller activation.
- **Cohort retention** and GMV by category/country.
- **Search insights**: top zero-result searches → content/category gaps.
- **Scheduled email report** to admins (weekly KPIs).

## Operations
- **Job/queue monitor**: auto-complete runs, email failures, retry button.
- **Maintenance mode** toggle with custom message.
- **Data tools**: GDPR export / delete for a user, with audit entry.
- **Backups page**: last Mongo backup time, restore guide.
- **Fix old endpoints** that return 500 on invalid ids (should be 400/404).
