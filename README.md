# Qwlee — Modern Freelance Marketplace

Three-app freelancing marketplace (rebranded from the legacy cnnctr codebase). Each app is a separate deployable.

> **New here?** Start with [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) for setup, then read [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). The full developer guide index lives in [`docs/`](./docs/). A short on-ramp for Claude Code sessions is in [`CLAUDE.md`](./CLAUDE.md).

> **All image uploads route through [ImgBB](https://api.imgbb.com/).** Nothing is written to local disk. Set `IMGBB_API_KEY` in `backend/.env`.

| App | Stack | Port | Purpose |
|---|---|---|---|
| `backend/` | Express 4 + Mongoose 8 + Socket.IO | `7171` (HTTP) + `8181` (socket) | REST API + websocket gateway |
| `frontend/` | **Next.js 16.2.6** + **React 19** (App Router, JS) | `8000` | Public marketplace |
| `admin/`    | Vite 5 + React 18 | `4000` | Internal admin dashboard |

## Prerequisites

- Node.js ≥ 20 (tested with 21.7)
- MongoDB running locally on `mongodb://localhost:27017`
  ```sh
  brew services start mongodb-community
  ```

## First-time setup

```sh
# backend
cd backend  && cp .env.example .env && npm install
# frontend
cd ../frontend && cp .env.example .env && npm install
# admin
cd ../admin    && cp .env.example .env && npm install
```

Fill in the `.env` files. **Required for local dev:**

- `backend/.env`: `MONGODB_URL`, `JWT_SECRET` (≥ 16 chars), `NODE_ENV=development`, `IMGBB_API_KEY`, **Stripe TEST keys** (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, optional `STRIPE_WEBHOOK_SECRET` from `stripe listen`). Other provider credentials (PayPal / Paddle / Lemon Squeezy / SSLCommerz / SMTP) are now managed from the admin panel.
- `frontend/.env`: `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:7171`, **`JWT_SECRET` identical to the backend's** (used by the route-gate middleware), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`).
- `admin/.env`: `VITE_API_BASE_URL=http://localhost:7171`.

## Running

Three terminals:

```sh
cd backend  && npm run dev    # nodemon, src/index.js
cd frontend && npm run dev    # next dev -p 8000
cd admin    && npm run dev    # vite, port 4000
```

Health check: `curl http://localhost:7171/v1/categories`.

## Seeding demo data

```sh
cd backend
npm run seed              # reset + reseed everything (recommended)
npm run seed:reset        # drop all collections, no insert
npm run seed:users        # only users
npm run seed:gigs         # users + categories + gigs (good for UI work)
node seeders/index.js --only=enrich   # rerun only the enrichment phase
```

**Seeded volumes (per full run)** — every feature has live data:

| Collection | Count | Notes |
|---|---|---|
| `users` | 28 | 2 admins · 7 freelancers · 17 buyers · **3 ID-verified sellers** with the gold tick |
| `categories` | 15 | Seeded for navbar Categories menu |
| `gigs` | 17 | **with `gigStatus` variety** (2 pending, 2 paused, 1 needs-changes, 1 draft, rest active) + impressions (80–950) + clicks (8–18% CTR) |
| `portfolios` | 30 | Multi-image, varied media types |
| `orders` (payments) | 28 | Mixed status; 1 has a pending **extension request**, 1 has full **cancellation audit** fields |
| `reviews` | 7 | Every review linked to its source order; **7 have seller replies** |
| `withdrawals` | 15 | Approved + pending + cancelled |
| `gigLoves` | ~17 | Wishlist coverage |
| `chats` / `messages` | 50 / 36 | Plus 36 order-thread messages |
| `notifications` | 21 | Order / message / payment types |
| `searchlogs` | 80 | **Realistic queries with countries** — powers the homepage Trending strip + admin Search logs page |
| `supporttickets` | 6 | Includes **1 admin-mediated ticket** with both buyer + seller as participants |
| `blogs` / `banners` | 5 / 4 | |
| `content` | 3 | Privacy + Terms + Trust & Safety |

The seeder prints **3 sample `/order/<id>` URLs** at the end so you can land on a populated order detail page immediately.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Seller | `seller@example.com` | `Seller123!` |
| Buyer | `buyer@example.com` | `Buyer123!` |

Full seeded user list (14 + extras) lives in `backend/seeders/usersSeeder.js`.

---

## Feature surface

### Marketplace (`frontend/`)

**Auth + access**
- Sign-in / sign-up / forgot-password / verify-email (6-digit OTP, Fiverr-style split-input, auto-advance, paste-six-at-once, resend with 60s cooldown)
- "Keep me signed in" persists cookies for 30 days; unchecked keeps session-only
- **Edge middleware route gate** (`frontend/middleware.js`) with prefix matching — protects `/dashboard`, `/order/:any`, `/inbox/:any`, `/support/:any`, `/notifications`, `/list`, `/earnings`, `/profile/:any`, `/gig/add`, `/gig/edit`, `/change-password`
- **Deep-link preservation** — unauth user hits `/order/abc` → bounced to `/sign-in?from=/order/abc` → after login lands on `/order/abc`. `from` survives every hop (sign-in → sign-up → verify-email → change-password → back to sign-in). Open-redirect guard rejects `//evil.com`-style values.
- Real-time **force logout via socket** when an admin bans an account — clears cookies and bounces to `/sign-in?banned=<reason>`

**Discovery**
- Hero with rotating placeholder + **CSS-keyframe entrance animations** (no framer-motion stacking issues on route restores)
- **Live trending searches** (≥ 2 hits, capped at 6 chips) pulled from `/v1/search/trending`
- Search dropdown — glass-vibe panel removed in favour of clean solid white; recents + trending with overflow scroll
- **Fiverr-style FilterBar** on `/gig` — Categories, Seller details (level / language / country / online / verified / min rating), Budget (preset buckets + custom min/max), Delivery time (Express 24h → 14 days), pinned Online-sellers quick toggle
- Active filter chips above the grid; URL-state driven
- Trending search tracker fires on submit, suggestion click, dropdown result click, and URL `?title=` changes (1.5s throttle per (query, route))

**Browsing**
- Gig detail with package picker, gallery, reviews (avg + 5-bar histogram), money-protection guarantee strip
- Public freelancer profile (`/[username]`) with portfolio, reviews, gigs, contact CTA
- Categories menu uses shared icon catalog (react-icons)
- Per-gig impression + click counters fired by the gig detail page

**Buying**
- Stripe Checkout (default) + adapter for PayPal / Paddle / Lemon Squeezy / SSLCommerz / custom (admin-configurable)
- Custom offer flow in the inbox; accept → checkout
- Wishlist (love/unlove on gigs, dedicated `/list` page)
- Multi-tab Manage Orders with status counts
- **Order detail page** —
  - Status header with countdown for sellers, "Mark as completed" / "Leave a review" for buyers
  - Activity (chat) thread with delivery card + Accept-delivery CTA
  - **Delivery date extension flow** — seller requests, buyer accepts/declines inline in the chat **and** in the right-rail card. Extension events emit system bubbles in the order chat.
  - **Order chat auto-closes** once status hits `delivered` / `cancelled` — composer is replaced by an info card with "Go to inbox" CTA
  - **Leave-a-review modal** — Fiverr-style 5-star hover picker, 10–1000 char body, validates submit, only enabled when status is `delivered` and no review exists yet
  - Seller's reply to a review renders as an indented emerald block on the gig page

**Selling (`/dashboard` in selling mode)**
- KPI strip (Active / Delivered / Cancelled / Earnings)
- **Level overview card** — current Fiverr-style level pill, Success score / Rating / Response rate metrics, progress bars toward the next level (Orders, Unique clients, Earnings, Rating). Honours admin override (pinned tier hides progress and surfaces the override note).
- **Gigs with status tabs** — Active / Pending Approval / Requires Modification / Draft / Denied / Paused with counts. Per-gig last-30d Impressions / Clicks / Orders / Cancellations (rate + count). Rejection reason banner under denied/needs-changes rows. View + Edit per-row actions. "Create a new Gig" CTA.
- **Earnings page** — emerald-gradient hero, three KPI cards (Available / Pending clearance / Lifetime), 6-month inline bar chart of net withdrawals, polished withdrawal-history table, redesigned withdraw modal with "Use max" shortcut

**Messaging**
- Real-time DM inbox + order chat with JWT-handshake socket auth
- Online presence, typing indicators, unread badges
- Emoji picker (6-category palette) + **video-call kick-off** (Jitsi URL shared as a message)
- Custom offer composer (seller → buyer)

**Profile + settings**
- Profile edit (avatar, cover, intro, skills, location, language, hourly rate)
- **Avatar dropdown** — Fiverr-style rich panel (44px avatar, role pill, mode toggle row, link list, sign out). Single rounded card via antd `dropdownRender`.
- Notifications dropdown — pinned header/footer with slim scroll inside, "See all notifications →" links to a dedicated `/notifications` page with status filter pills
- **Search bar** redesigned — rounded-full pill with focus ring, slate→emerald submit button, hidden submit label on `<sm` screens
- Hero animations: pill / headline / blurb / search / trending chips / trust cards each enter with staggered CSS keyframes; respects `prefers-reduced-motion`

**Frontend animations** — `components/common/Reveal.js` for scroll-into-view fade-up, used across all marketplace homepage sections (Stats, Categories, Freelancers, WhyChooseUs, Testimonials, NewsAndBlog). MarketplaceStats has count-up numbers via `useMotionValue`.

### Admin (`admin/`)

Dashboard home (`/dashboard`) — full redesign:
- **Hero stat band** with sparklines + delta% pills: Revenue this month, Orders (30d), New sign-ups (this mo.), Avg order value
- Full-width revenue area chart with year selector
- 3-up donut/bar row: **Order status mix**, **Freelancers vs Buyers**, **New sign-ups bar chart**
- **Leaderboards** — Top sellers (by earnings) + Top gigs (by order count), both derived from live order data
- Recent users feed

Pages:
- **Orders** — status tabs with counts, search, **Ticket** button (opens admin-mediated support ticket with the buyer + seller as participants), **Cancel** button (force-cancel any order with claw-back of credited seller balance when applicable)
- **Gigs** — status tabs (All / Active / Pending / Needs changes / Draft / Denied / Paused), Moderate action (status + reason → emails the seller), **Delete** (soft by default with reason; hard delete gated to gigs without order/review history), Restore for soft-deleted gigs
- **Categories** — react-icons picker (no emoji)
- **Freelancers / Buyers** — ban/unban with reason
- **Personal info / Edit personal info** — admin profile
- **Earnings / Withdrawals** — approve, decline, payouts table
- **Blog** — list, add, edit, delete with jodit-react WYSIWYG
- **Reports** — recharts visualisations
- **Settings** — tabbed page
  - **Payments**: per-provider cards (Stripe / PayPal / Paddle / Lemon Squeezy / SSLCommerz) with enabled toggle, mode (test/live), credential inputs with show/hide, status pill
  - **Custom providers**: add a provider with a `checkoutUrlTemplate` (`{amount}` / `{currency}` / `{orderId}` placeholders) + enable/disable
  - **SMTP server**: host, port, user, pass, secure, from email + name. Below the form: **Send a test email** card with template dropdown (every transactional email + "Send all") so the admin can verify SMTP works the moment they save it.
  - **Misc** k/v editor for arbitrary platform config
  - **Account & policies**: links to legal pages + change password
- **Privacy / Terms / Trust & Safety** — rich-text editors writing to a single document per content type
- **Support** — admin ticket inbox with status filter, thread view, status switcher (open/pending/resolved/closed)
- **ID Verifications** — review submitted documents, approve/reject with reason
- **Conversations** — read-only DM + order-chat moderator view
- **Search logs** — paginated table of every marketplace search with country/IP/route/who; KPI tiles (total / 24h / 7d / unique queries / anon vs auth) + top-country pills
- **Seller levels** — edit the tier ladder globally (id / label / minOrders / minClients / minEarnings / minRating; add/remove tiers) **and** pin any individual seller to a specific tier with a reason
- **Reports / Notifications**

Cross-cutting:
- Admin route guard with deep-link preservation (`AdminRoute` passes `state.from`, `Login` honours it). Already-authed admins on `/` get bounced to their last target.
- Real-time logout when a target user is banned (socket emit `auth/force-logout`)

### Backend (`backend/`)

Endpoints — every category has admin + user surfaces.

| Route prefix | Key endpoints |
|---|---|
| `/v1/auth` | `register`, `login`, `verify-email`, `forgot-password`, `reset-password`, `change-password`, `refresh-tokens`, `logout` |
| `/v1/users` | List (with filters), `by-username/:username`, `profile`, `profile-image`, public stats |
| `/v1/gig` | CRUD, public list (with `delivery` / `language` / `country` / `online` / `verifiedOnly` / `minRating` / `level` filters), love, `mine/level`, `mine/stats`, `:gigId/impression`, `:gigId/click` |
| `/v1/categories` | CRUD, list |
| `/v1/orders` | Stripe webhook, checkout, list, counts, **`:orderId/extension`** (request + respond), modify, freelancer list |
| `/v1/payments` | `methods` (public — enabled providers only), `checkout` (multi-provider router) |
| `/v1/reviews` | Create (only on delivered orders), list, `by-order/:orderId`, **`:reviewId/reply`** |
| `/v1/notification` | Mine, mark-read, mark-all-read |
| `/v1/withdrawal` | Create, list, mine, single, approve, cancel |
| `/v1/chat`, `/v1/message`, `/v1/order-message` | Inbox + order chat |
| `/v1/banner-image` | List + admin CRUD |
| `/v1/activity/track` | Per-user IP/route/dwell tracking |
| `/v1/support/tickets` | User CRUD + admin list + replies |
| `/v1/verification` | Submit + admin approve/reject |
| `/v1/search/track`, `/v1/search/trending` | Anonymous-friendly tracker + public top-N |
| `/v1/admin/*` | Total status, income/user ratio, recent users, earnings, orders, gigs, ban/unban user, user activity, settings (payments/SMTP/custom/misc), test-email, chats, order-chats, **searches + search-stats**, **orders/:id/cancel**, **gigs/:id/status / delete / restore**, **support/tickets** (admin-initiated), **seller-levels** (list, tiers, override) |

Data model additions:
- `AppConfig` singleton — payment providers (built-in + custom), SMTP, `sellerLevels[]` ladder, misc k/v
- `SearchLog` — query, displayQuery, userId (nullable), ip, country, countryCode, route, referer, userAgent, timestamps
- `User.levelOverride` — admin-pinned tier
- `User.verification` — submitted/approved/rejected ID flow
- `User.isBan` + `banReason` + `bannedAt`
- `Gig.gigStatus` + `stats.{impressions, clicks}` + `moderation.{reason, reviewedBy, reviewedAt}`
- `Payment.extensionRequest` + `Payment.cancellation{Reason,At,FromStatus}` + `cancelledBy`
- `Reviews.orderId` + `Reviews.sellerReply`
- `SupportTicket.participants` + `openedBy` + `openedByRole` + `orderId` + `reason`
- `OrderMessage.content.messageType` accepts `extensionRequest` / `extensionResponse` + `extensionDetails` payload

Transactional email — **all templates Fiverr-styled**:
- Auth: signup verification, password reset, email confirmation
- Orders: confirmed (buyer + seller), delivered (buyer), accepted (seller), cancelled (both)
- Extension: requested (buyer), accepted/declined (seller)
- Reviews: received (seller), replied (buyer)
- Messaging: custom offer received, new inbox message
- Withdrawals: requested, approved, declined
- Moderation: account banned, ID verification approved/rejected

Every email uses a single `emailShell()` template with summary tables, quote blocks, OTP blocks, and 5 accent tones (emerald/sky/amber/rose/violet). Lazy SMTP transport reads creds from AppConfig with `.env` fallback — admin can rotate SMTP from the UI without a server restart.

Payments — multi-provider checkout router (`services/paymentRouter.service.js`):
- **Stripe** — Checkout Sessions
- **PayPal** — Orders v2 (OAuth → create order → approval link)
- **Paddle** — Transactions API (hosted checkout URL)
- **Lemon Squeezy** — v1 `/checkouts` with `custom_price`
- **SSLCommerz** — Bangladesh gateway init (sandbox + live URLs)
- **Custom** — admin-defined `checkoutUrlTemplate` with `{amount}` / `{currency}` / `{orderId}` placeholders

All credentials come from AppConfig; `.env` is only a one-time bootstrap.

## Session log

- Search + monitoring: every marketplace search logged with country/IP; admin "Search logs" page; live homepage Trending strip
- Multi-provider payments: AppConfig-managed credentials + adapter for PayPal / Paddle / Lemon Squeezy / SSLCommerz / custom
- Email overhaul: Fiverr-style template shell + 19 transactional emails; lazy AppConfig-backed SMTP; admin "Send test email" panel
- Auth UX: 6-digit OTP page redesign; "Keep me signed in" wired correctly; cross-app deep-link preservation through every funnel; real-time force-logout via socket on ban
- Reviews: order-scoped + sellerReply field; review modal + seller reply UI on gig page
- Extension flow + auto-closed order chat
- Order cancellation by admin with balance claw-back + audit fields
- Admin-mediated multi-participant support tickets with order linkage
- Gig filter bar (Fiverr-style) + 7 new server-side filter params
- Seller dashboard redesign: Level overview, gigs-with-tabs, stats
- Admin redesign: hero KPI sparklines, donuts, leaderboards
- Seller level system end-to-end: tiers in AppConfig, per-seller override, dedicated admin page
- Gig moderation: status transitions, soft + hard delete, restore
- Earnings page Fiverr redesign
- Notifications dropdown polish + dedicated `/notifications` page
- Navbar polish: search pill button, balance pill in seller mode, "Become a seller" swap when authed, Trending pills with stagger
- Homepage animations across all sections (CSS keyframes for the hero; framer-motion's `Reveal` for the rest); count-up MarketplaceStats numbers
- Edge middleware: prefix-based route gating with deep-link preservation
- Seed enrichment: gig stats, gig statuses across all tabs, ID-verified sellers, reviews with orderId + replies, 80 realistic search logs, admin-mediated ticket, order extension + cancellation audit data
- Admin: Banner slider section removed (unused)
