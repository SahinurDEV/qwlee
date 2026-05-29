# Architecture

## High level

```
                       ┌─────────────────────┐
                       │   MongoDB :27017    │
                       └──────────┬──────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
        ┌─────────▼─────────┐         ┌──────────▼──────────┐
        │  Backend API      │         │  Socket.IO server   │
        │  Express 4        │         │  port 8181          │
        │  port 7171        │         │  (same process)     │
        └───────┬─────┬─────┘         └──────────┬──────────┘
                │     │                          │
        REST    │     │   REST           Socket  │
                │     │                          │
        ┌───────▼─┐ ┌─▼──────────┐      ┌────────▼────────┐
        │ Admin   │ │ Marketplace│      │ Browser clients │
        │ Vite    │ │ Next.js 16 │      │ (both apps)     │
        │ :4000   │ │ :8000      │      └─────────────────┘
        └─────────┘ └────────────┘
```

## Apps

### `backend/`
- **Express 4** with **Mongoose 8**. Single process boots both the HTTP server (port 7171, host 0.0.0.0) and the Socket.IO server (port 8181) — see `src/index.js`.
- **Auth**: JWT (HS256) via `passport-jwt`. Tokens carry `userId` + `role`. 15-minute access tokens, 30-day refresh tokens.
- **Roles** (`config/roles.js`): `freelancer`, `buyer`, `admin`. Synthetic rights: `common` (any signed-in user), `withOutAdmin` (any non-admin).
- **Logger**: `winston` (`config/logger.js`). Don't use `console.log`.
- **Config**: dotenv + Joi schema validation in `config/config.js` — invalid env crashes on boot.

### `frontend/`
- **Next.js 16.2.6** App Router, JavaScript only (no TS). Turbopack dev server.
- **Redux Toolkit + RTK Query** (`app/redux/`) — single shared `baseApi` slice, feature endpoints injected via `baseApi.injectEndpoints`.
- **Auth token** is a cookie named `accessToken` (JSON-stringified). `baseApi.prepareHeaders` reads and attaches it. The edge middleware (`middleware.js`) decodes the JWT to gate routes — that's why `JWT_SECRET` must match the backend.
- **Realtime**: `socket.io-client` against `NEXT_PUBLIC_SOCKET_URL`. Wired in `components/Context/SocketProvider.js`.
- **Auth-gated paths**: prefix list in `middleware.js`. Unauth requests get bounced to `/sign-in?from=<original>`.

### `admin/`
- **Vite 5** + **React 18** SPA.
- **react-router-dom v6** in `src/router/Route.jsx`. Add a page → add a route → add a sidebar entry.
- All API endpoints live in **one** RTK-Query slice at `src/redux/api/apiSlice.js`. Add an endpoint there and re-export its hook from the bottom.
- Auth token is in `localStorage` under the `token` key. Each endpoint manually attaches `Authorization: Bearer …` — there's no `prepareHeaders` indirection.

## Data flow (typical REST call)

```
React component
  └─ uses RTK-Query hook  (e.g. useGetMyDisputesQuery)
       └─ baseApi attaches accessToken cookie
            └─ fetch http://localhost:7171/v1/disputes/my
                 └─ Express router (/v1/disputes)
                      └─ auth middleware (passport-jwt + role check)
                           └─ controller (catchAsync)
                                └─ service (business logic + Mongoose)
                                     └─ MongoDB
                                └─ response({...}) → JSON envelope
            └─ transformResponse strips envelope
       └─ data lands in the component
```

The response envelope is:

```json
{
  "code": 200,
  "message": "OK",
  "data": {
    "attributes": { /* the real payload */ }
  }
}
```

Frontend slices do `transformResponse: (res) => res?.data?.attributes` to flatten this.

## Realtime flow

The Socket.IO server runs in the same Node process as the API. Authentication is done via a JWT handshake.

Events the frontend listens for include `new-message`, `new-message-self`, `new-chat`, `freelancer-notification::<userId>`, `buyer-notification::<userId>`, `admin-notification::admin`, `auth/force-logout`. The notification service helper `addCustomNotification(eventName, userId, body)` persists a row AND emits the correct event in one call — prefer it over hand-rolling the socket emit.

## Models (canonical)

The most important Mongoose models:

| Model | File | Purpose |
|---|---|---|
| `User` | `models/user.model.js` | Buyer / freelancer / admin. Carries `verification`, `levelOverride`, `isBan`, `balance`, etc. |
| `Gig` | `models/gig.model.js` | Service listing with `gigStatus` lifecycle + `stats.{impressions, clicks}` |
| `Categories` | `models/categories.model.js` | Marketplace categories |
| `Payment` | `models/payment.model.js` | **Canonical order record** (despite the name). Used by most order code paths. |
| `Orders` | `models/orders.model.js` | Vestigial; keep enums in sync but new features should target `Payment`. |
| `OrderMessage` | `models/orderMessage.model.js` | Per-order chat thread |
| `Reviews` | `models/reviews.model.js` | Order-scoped reviews with optional seller reply |
| `Dispute` | `models/dispute.model.js` | Order dispute thread + resolution (PRD §5.10) |
| `Chats` / `Messages` | `models/chat.model.js` / `models/message.model.js` | DM inbox |
| `Withdrawal` | `models/withdraw.model.js` | Payout requests |
| `Notification` | `models/notification.model.js` | In-app feed |
| `SupportTicket` / `SupportMessage` | `models/supportTicket.model.js` / `models/supportMessage.model.js` | Support |
| `AppConfig` | `models/appConfig.model.js` | Singleton: payment providers, SMTP, seller-level tiers, misc k/v |

The full export list is `backend/src/models/index.js`.

## Auth + permissions

- **JWT** issued by `services/token.service.js` after a successful `auth/login`. Stored client-side in the `accessToken` cookie (frontend) or `localStorage` (admin).
- Verified server-side by `middlewares/auth.js` using `passport-jwt`. The middleware reads role from `User` and checks the required role/right against `config/roles.js`.
- **Role table** (`config/roles.js`):
  ```js
  {
    freelancer: ['freelancer','common','withOutAdmin'],
    buyer:      ['buyer','common','withOutAdmin'],
    admin:      ['admin','common'],
  }
  ```
  So `auth("common")` accepts any signed-in user, `auth("withOutAdmin")` accepts buyer or freelancer, `auth("admin")` is admin-only.
- **Edge gating** in the frontend (`frontend/middleware.js`) is a separate fast check that decodes the JWT and bounces unauth visits before the server component runs. The signature secret here must match `backend/.env`'s `JWT_SECRET` or every page will redirect.

## Payment flow

`services/paymentRouter.service.js` is a multi-provider checkout router. The provider used per checkout is decided by `AppConfig.payments.activeProvider` (or the request's `provider` param). Supported: Stripe, PayPal, Paddle, Lemon Squeezy, SSLCommerz, plus admin-defined custom providers (URL templates with `{amount}`/`{currency}`/`{orderId}` placeholders).

All provider credentials live in `AppConfig` (Mongoose singleton). `.env` Stripe keys are a one-time bootstrap; the admin can rotate any of this from `/dashboard/setting → Payments` without a server restart.

## Email flow

`services/email.service.js` builds every transactional email with a single `emailShell()` template (summary tables, quote blocks, OTP blocks, 5 accent tones). SMTP transport is lazy — reads credentials from `AppConfig.smtp` with `.env` fallback. Admin can hot-rotate SMTP from `/dashboard/setting → SMTP`. A "Send test email" panel on that page hits `/v1/admin/settings/test-email` with a template selector.

## Where things plug in

| Touchpoint | Where |
|---|---|
| Add a new backend endpoint | service → controller → routes/v1/ → mount in `routes/v1/index.js` |
| Add a Mongoose model | `models/<name>.model.js` + export in `models/index.js` |
| Add a frontend page | `frontend/app/<route>/page.js`. Gate it in `middleware.js` if it should require auth. |
| Add an admin page | `admin/src/dashboard/menu/<Page>.jsx` + `router/Route.jsx` + `dashboard/layout/Sidebar.jsx` |
| Add an admin API call | One block in `admin/src/redux/api/apiSlice.js` |
| Add a frontend API call | New file in `frontend/app/redux/features/<area>/<name>Api.js`, injecting into `baseApi` |
| Add a socket event | Emit from a service → consume in a frontend `useEffect` with `socket.on(...)` |
