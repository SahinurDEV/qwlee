# Qwlee

An open-source, Fiverr-style freelance services marketplace: sellers publish gigs, buyers order them, both sides chat in real time, and admins manage everything from a dashboard.

| App | Stack | Port |
|---|---|---|
| `backend/` | Express 4, Mongoose 8, Socket.IO | 7171 (REST), 8181 (socket) |
| `frontend/` | Next.js 16, React 19, Redux Toolkit, Tailwind | 8000 |
| `admin/` | Vite 5, React 18 | 4000 |
| database | MongoDB 7 | internal |

Full feature list: [docs/FEATURES.md](docs/FEATURES.md). Architecture and developer guides: [docs/](docs/).

## Quick start (Docker)

Requires Docker with Compose v2.

```sh
git clone https://github.com/SahinurDEV/qwlee.git
cd qwlee
cp .env.example .env          # set JWT_SECRET (openssl rand -hex 64)
docker compose up --build
```

Then open:

- Marketplace: http://localhost:8000
- Admin dashboard: http://localhost:4000
- API: http://localhost:7171 (health: `/health`; Swagger docs at `/v1/docs` when `ENABLE_API_DOCS=true`)
- Mailpit (every email the app sends, e.g. verification and reset codes): http://localhost:8025

Load demo data (in another terminal):

```sh
docker compose exec backend npm run seed
```

Demo logins after seeding: `admin@example.com / Admin123!`, `seller@example.com / Seller123!`, `buyer@example.com / Buyer123!`.

Seed images are committed under `backend/public/seed/` and served by the API at `/seed/...`, so demo data never depends on an external image host. Seeded image URLs use `PUBLIC_API_URL`; re-run the seed if you change it.

MongoDB data persists in the `mongo-data` volume. `docker compose down -v` wipes it.

## Configuration

All Docker config lives in the root `.env` (see [.env.example](.env.example)).

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes | Signs/verifies auth tokens (backend + frontend middleware) |
| `PUBLIC_API_URL`, `PUBLIC_SOCKET_URL` | no | URLs the browser uses to reach the API; baked in at build time, so rebuild after changing |
| `FRONTEND_URL`, `CORS_ORIGINS` | no | Redirect target and allowed origins |
| `*_PORT` | no | Host ports |
| `IMGBB_API_KEY` | optional | Store uploads on ImgBB; without it they go to the local `uploads` volume |
| `STRIPE_*` | for payments | Use test keys locally |
| `SMTP_*`, `EMAIL_FROM` | for email | OTP and password-reset email |
| `ENABLE_API_DOCS` | no | Serve Swagger UI at `/v1/docs` outside development |
| `PLATFORM_FEE_PERCENT` | no | Commission on completed orders (default 5). Admin can override in Settings > Misc with key `platformFeePercent` |
| `DEMO_PAYMENTS` | no | When no `STRIPE_SECRET_KEY` is set, place orders without charging (default `true` in compose). **Set to `false` in production.** |
| `AUTO_COMPLETE_DAYS` | no | Days after a delivery before the order auto-completes and escrow is released (default 3) |
| `REQUEST_TTL_DAYS` | no | Days a buyer request stays open for offers (default 14) |
| `ORDER_HOUSEKEEPING_MS` | no | Interval of the auto-complete / late-marking job (default 600000) |
| `CANCEL_RESPONSE_HOURS` | no | Hours the other party has to answer a mutual cancellation request before it is auto-accepted (default 48) |
| `PROMO_DAY_PRICE` | no | Price per day, in dollars, for promoting a gig (default 5) |
| `FX_RATES_URL` | no | USD exchange-rate JSON with a `rates` object (for example `https://open.er-api.com/v6/latest/USD`), refreshed every 12 hours. Without it, a built-in approximate table is used |
| `CURRENCIES` | no | Display currencies offered, comma-separated, from USD, EUR, GBP, BDT, INR, AUD, CAD, JPY (default: all) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | no | Send PayPal withdrawals with the PayPal Payouts API. Without them PayPal payouts run in demo mode |
| `PAYPAL_ENV` | no | `sandbox` (default) or `live` |
| `PAYONEER_API_TOKEN` / `PAYONEER_PROGRAM_ID` | no | Send Payoneer withdrawals with the Payoneer Mass Payout API. Without them Payoneer payouts run in demo mode |
| `PAYONEER_API_URL` | no | Payoneer API base (default `https://api.sandbox.payoneer.com`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | optional | Google sign-in (see below) |
| `UPLOAD_DIR`, `PRIVATE_UPLOAD_DIR` | no | Local upload folder (default `backend/uploads`) and the non-public folder for ID documents (default `<UPLOAD_DIR>/.private`) |
| `SECOND_APPROVAL_OVER` | no | Initial value of the admin setting: refunds/payouts above this amount need a second admin (0 = off) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_ENDPOINT_HOSTS` | optional | Browser push notifications (see Notifications) |
| `AUTH_RATE_LIMIT_MAX` | no | Failed `/v1/auth` requests allowed per IP per 15 minutes (default 20). The test suite runs with a higher value |
| `GEOIP_URL` | no | IP-to-country lookup used for the buyer's country (default `https://ipapi.co/{ip}/json/`; empty disables it) |

Other payment providers and SMTP can also be configured from the admin panel.

### Email

Out of the box all email goes to the bundled Mailpit inbox at http://localhost:8025, so sign-up verification and password reset work without a real mail server. To send real email set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` and `EMAIL_FROM` in `.env` (or in the admin panel). If sending fails, password reset returns an error instead of pretending it worked.

### Payments with Stripe (test mode)

1. Create a free Stripe account and copy the **test** keys from https://dashboard.stripe.com/test/apikeys into `.env` as `STRIPE_SECRET_KEY` (`sk_test_...`) and `STRIPE_PUBLISHABLE_KEY` (`pk_test_...`).
2. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward webhooks: `stripe listen --forward-to localhost:7171/v1/orders/webhook`. Put the printed `whsec_...` value in `STRIPE_WEBHOOK_SECRET`.
3. `docker compose up -d --build backend`, then pay with card `4242 4242 4242 4242`, any future date and any CVC.

## Google sign-in (optional)

The "Continue with Google" button on sign-in and sign-up only appears when the backend has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

1. In Google Cloud Console, create an OAuth client ID of type *Web application*.
2. Add the authorised redirect URI `<PUBLIC_API_URL>/v1/auth/google/callback`, for example `http://localhost:7171/v1/auth/google/callback`. To use a different URI, set `GOOGLE_REDIRECT_URI`.
3. Put both values in `.env` and run `docker compose up -d`.

New Google users become buyers with a verified email. If an account with the same email already exists, it is linked. If that account had never verified its email, its password is removed so that only the real owner can get in. A new Google user who arrived through a referral link (`?ref=`) gets the referral coupon, just like a form sign-up. Tokens never appear in URLs: the callback hands the frontend a two-minute, single-use code, which it exchanges at `POST /v1/auth/google/exchange`.

## Two-factor sign-in

Any user can turn on two-factor sign-in (TOTP: Google Authenticator, 1Password, Authy…) under Profile → Edit. It gives 8 single-use recovery codes. After that, password sign-in asks for a code. Google sign-in returns a short-lived challenge, which `POST /v1/auth/2fa/verify` exchanges for tokens with the code. Admins manage theirs in the admin panel (Security), where a super admin can also require 2FA for all admins.

## Notifications

In-app notifications are always kept. At `/notifications/settings` each user chooses, per category (orders, messages, reviews, requests, payments, news), whether they also get an email and a browser notification. Sign-in codes, password resets, payment and payout emails, and account notices are always emailed.

Browser (Web Push) notifications need a VAPID key pair in `.env`:

```
docker compose exec backend npx web-push generate-vapid-keys
# then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:you@example.com
```

Without keys the "Browser notifications" switch says they aren't set up, and pushes are only logged (`[push:demo]`). For safety, the server only sends to the browser push services (Chrome/FCM, Firefox, Apple, Microsoft). Override this with `PUSH_ENDPOINT_HOSTS`. Push needs HTTPS, or `localhost`, and the site's own `/sw.js` service worker. Tunnels with an interstitial page, such as ngrok's free plan, break service worker registration because `/sw.js` comes back as HTML.

## Admin site settings

These live in the database and are edited in the admin panel (Site settings). They are read through `GET /v1/info/site` (public part only).

| Setting | Default | Purpose |
|---|---|---|
| `features.signups`, `features.buyerRequests`, `features.tips`, `features.googleLogin` | on | Switch features off without a deploy |
| `growth.referrals` | on | Referral programme (`/referrals` page, `GET /v1/growth/referrals/me`) |
| `growth.refereePercent` | 10 | % off the invitee's first order (single-use coupon, max $100, 90 days). Applied for form and Google sign-ups that came through a `?ref=` link |
| `growth.referrerReward` | 10 | Fixed $ coupon given to the inviter when the invitee's first order completes |

Coupons are managed under Coupons in the admin panel (finance role). The platform funds the discount: the seller is paid, and the fee charged, on the full price; refunds return what the buyer paid.

## Order lifecycle

1. Buyer checks out a gig package (+ optional extras) or a custom offer. Prices are always computed on the server (`POST /v1/orders/quote` previews them).
2. Payment (Stripe, or demo mode) is held in **escrow** on the order.
3. If the gig has requirement questions, the buyer answers them; the delivery clock starts then.
4. Seller delivers; buyer accepts or requests a revision (limited by the package).
5. On acceptance, or `AUTO_COMPLETE_DAYS` after delivery, escrow is released to the seller minus the platform fee. Cancellations and dispute refunds return escrow to the buyer. A seller can cancel at any time and a buyer can cancel a late order; otherwise the buyer sends a cancellation request that the seller accepts or declines (auto-accepted after `CANCEL_RESPONSE_HOURS`).

### Promoted gigs

Sellers can promote an active gig from the Promote link in their gig table, or at `/promotions`. Each day costs `PROMO_DAY_PRICE` and is paid from the seller's balance up front. Buying again for the same gig extends the promotion. On page 1 of a marketplace search, up to two promoted gigs that match the search are shown in a "Sponsored" row above the results, with the slot rotating among them. Sponsored impressions and clicks are counted for each promotion. If a seller stops a promotion early, whole unused days go back to their balance. The demo seller (`seller@example.com`) is seeded with a $250 balance.

Categories have one level of subcategories (`GET /v1/categories` lists top-level; `?parentId=<id>` lists one parent's subcategories; `?level=all` lists both). Admins manage them on the Categories page. The marketplace can be filtered by subcategory (`/gig?subCategory=<id>`) and delivery time (`delivery=<days>`).

Gigs support extras, FAQ, requirement questions and an optional YouTube/Vimeo/MP4 video.

### Display currency

Every price is stored and charged in US dollars. Visitors can choose a display currency in the footer. The choice is saved in the browser, and prices on gig cards and gig pages are then shown converted and marked "≈", with the USD amount in the tooltip. The checkout review shows the USD charge with the converted amount underneath. Rates come from `GET /v1/info/currencies`.

### Payouts

Sellers withdraw to a bank account, PayPal (by email) or Payoneer (by payee id). Bank transfers are paid manually by the finance team, as before. When finance approves a PayPal or Payoneer withdrawal, the payout is sent to the provider straight away. The withdrawal id is used as the provider reference, so a retry can't pay twice. If the provider refuses, the withdrawal goes back to Pending with the error shown, so finance can retry or decline it. Without credentials, the payout is recorded as `demo` and nothing is sent. `GET /v1/withdrawal/methods` shows which methods are live.

Not verified against the real providers: the PayPal and Payoneer request formats follow their public API docs and are covered by stubbed tests, but no sandbox account has been used.

### Subscriptions

Sellers can offer monthly subscriptions on an active gig, with an optional discount of up to 30%. They set this on `/subscriptions`. On the gig page, a buyer can then use "Subscribe monthly" on a package. The first month is ordered straight away, and after that a normal order is created each month by the order housekeeping job, so escrow, delivery and payout work as for any order. The buyer can pause or resume a subscription, and either side can cancel it. A month that can't be ordered (for example, the seller is away or the gig was removed) is recorded as failed and retried the next month. Super admins can run billing now with `POST /v1/admin/jobs/subscriptions` (optional `asOf`).

Limitation: recurring card billing (Stripe Billing or off-session charges) is not implemented. Subscriptions only work while demo payments are on; otherwise the API answers 503.

### Milestone payments

A custom offer sent in chat can be split into 2 to 6 milestones. Each milestone has a title, an amount (at least $5) and a number of days, and the milestone amounts must add up to the offer price. The buyer pays the full price into escrow at checkout. On the order page, the buyer releases each milestone as the work arrives, and the seller is paid that share minus the platform fee. Releasing the last milestone, accepting the delivery, or auto-completion releases whatever is still held. Cancelling refunds only the part that hasn't been released (`POST /v1/orders/:id/milestones/:index/release`).

### Buyer requests

Buyers post a request (`/requests/new`) with a budget and deadline. Sellers browse open requests (`/requests`) and send one offer each (price, days, revisions, message). The buyer sees every offer and can decline it or hire. Hiring goes through the same server-priced escrow checkout (`POST /v1/orders/checkout {requestOfferId}`). It accepts that offer, declines the others and marks the request hired. Requests expire after `REQUEST_TTL_DAYS` (default 14).

After upgrading an existing database run `docker compose exec backend npm run migrate` (idempotent).

## Keyword filters and risk flags

Admin → Site settings → "Keyword filters & risk rules" holds the rules:
- **Blocked words:** messages, custom offers, gigs, buyer requests and request offers containing one are refused with a 400.
- **Flagged words:** the text is accepted, but a risk flag is opened for review.

Words match whole words in any case, and phrases may span spaces or line breaks. A word inside a longer word (for example `scam` in `scampi`) doesn't match.

Other rules also open flags:
- With "flag contact info" on (the default), emails, phone numbers and messenger links (WhatsApp, Telegram, Skype and so on) in messages, offers and requests open a flag.
- Orders are flagged when an account younger than 3 days places one at or above the set amount (default $500, 0 turns it off), or when a buyer places 3 or more orders within an hour.

Moderators work the queue under Moderation → Risk flags (`GET /v1/admin/risk-flags?status=&kind=`, `PATCH /v1/admin/risk-flags/:id {status: open|dismissed|actioned, note}`). Changing the rules needs the settings permission.

## Manual setup (without Docker)

Prerequisites: Node.js 20.9+ and MongoDB on `localhost:27017`.

```sh
cd backend  && cp .env.example .env && npm install && npm run dev
cd frontend && cp .env.example .env && npm install && npm run dev
cd admin    && cp .env.example .env && npm install && npm run dev
cd backend  && npm run seed   # optional demo data
```

`JWT_SECRET` must match in `backend/.env` and `frontend/.env`. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) and [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Tests

With a seeded stack running:

```sh
scripts/test-live.sh
```

The script snapshots the database first and restores it when the tests finish, so running the suite against a demo or live stack leaves no test orders, edits or users behind. Set `API_URL` to point it at another URL. `cd backend && npm test` runs the same tests without the snapshot (fine for a throwaway database, as in CI).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
