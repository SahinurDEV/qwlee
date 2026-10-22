# Fiverr feature gap analysis

Sources: Fiverr Help Center public pages (Availability, Milestones, Order Timeline, Creating a Gig, Buyer FAQs), October 2026.

## Already in Qwlee
Gig packages, extras, FAQ, requirements, video, escrow and auto-complete, revisions, custom offers, buyer requests, seller levels, favourites (`/list`), disputes, reviews with seller reply, subcategories, delivery-time filter, Google sign-in.

## Added in this round
| Feature | Fiverr behaviour | Qwlee |
|---|---|---|
| Vacation mode | Gigs stay visible but leave search; no new orders; return date and message; auto-ends | `availability` on the user, set in Edit profile; away banner on the gig page; checkout blocked (409) |
| Gig search tags | 5 tags per gig | `tags[]` (max 5); search matches the title or tags; tag chips on the gig page |
| Tipping | After completion, within 30 days; $5 minimum; up to $25 under $25, else up to 100% | `POST /orders/:id/tip` (Stripe or demo); seller credited net of the fee |

## Remaining gaps
| Gap | Value | Effort |
|---|---|---|
| Milestone orders (2–5 paid stages, each $50 or more) | High for big projects | High (payment per stage, partial escrow) |
| Order timeline / notes (seller-planned steps on long orders) | Medium | Medium |
| Response time / response rate metrics shown on profile | Medium (trust) | Medium (track first reply per conversation) |
| Pro / vetted badge (admin-granted) | Medium | Low (flag plus badge; admin UI) |
| Gig SEO meta (custom meta title/description, OG image) | Medium | Low |
| Seller onboarding checklist (profile, first gig, payouts) | Medium | Low-Medium |
| Saved lists with names (multiple collections) | Low-Medium | Low |
| Subscriptions / recurring orders | Medium | High |
| Hourly orders | Medium | High |
| Promoted gigs (paid ads) | Revenue | High |
| Seller analytics (impressions, clicks, conversion) | Medium | Medium (stats exist partially) |
| Multi-currency display | Medium | Medium |
| Order "share files" / delivery file storage beyond images | High | Medium (needs object storage) |
| Two-factor authentication | High (security) | Medium |
