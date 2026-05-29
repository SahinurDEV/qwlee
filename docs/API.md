# API reference

All endpoints are mounted under `/v1`. Base URL in dev: `http://localhost:7171/v1`.

## Swagger

Swagger UI is auto-generated from JSDoc annotations and served in **development only** at:

```
http://localhost:7171/v1/docs
```

Definitions live in `backend/src/docs/`. Annotate new endpoints with `@swagger` blocks above the route to keep the doc in sync.

## Response envelope

Every endpoint returns:

```json
{
  "code": 200,
  "message": "Human-readable summary",
  "data": {
    "attributes": { /* the real payload */ }
  }
}
```

Clients strip the envelope:

```js
transformResponse: (res) => res?.data?.attributes
```

## Authentication

- **Bearer JWT** in the `Authorization` header: `Authorization: Bearer <token>`.
- Get a token from `POST /v1/auth/login`.
- Refresh with `POST /v1/auth/refresh-tokens`.

## Endpoint surface (categories)

The full inventory lives in `README.md`'s **Backend → Endpoints** table. The categories below are stable entry points:

| Prefix | Notes |
|---|---|
| `/v1/auth` | register, login, verify-email, forgot-password, reset-password, change-password, refresh-tokens, logout |
| `/v1/users` | List + filters, `by-username/:username` (public profile aggregation), profile, profile-image, public stats |
| `/v1/gig` | CRUD + public list with rich filters (`delivery`, `language`, `country`, `online`, `verifiedOnly`, `minRating`, `level`), love/unlove, mine/level, mine/stats, `:gigId/impression`, `:gigId/click` |
| `/v1/categories` | CRUD + list |
| `/v1/orders` | Stripe webhook, checkout, list, counts, `:orderId/extension` (request + respond), modify, freelancer list |
| `/v1/payments` | `methods` (public — enabled providers only), `checkout` (multi-provider router) |
| `/v1/reviews` | Create (only on delivered orders), list, `by-order/:orderId`, `:reviewId/reply` |
| `/v1/disputes` | open, list mine, get one, respond, escalate, cancel (user-facing); list, resolve (admin) |
| `/v1/notification` | mine, mark-read, mark-all-read |
| `/v1/withdrawal` | create, list, mine, single, approve, cancel |
| `/v1/chat`, `/v1/message`, `/v1/order-message` | inbox + order chat |
| `/v1/banner-image` | list + admin CRUD |
| `/v1/activity/track` | per-user IP/route/dwell |
| `/v1/support/tickets` | user CRUD + admin list + replies |
| `/v1/verification` | submit + admin approve/reject |
| `/v1/search/track`, `/v1/search/trending` | anonymous-friendly tracker + public top-N |
| `/v1/admin/*` | every admin-only surface (users, orders, gigs, settings, seller-levels, conversations, searches, …) |

## Versioning

We're on **v1**. Breaking changes get a new prefix (`v2`), not a parameter flag.

## Errors

Errors come back with the same envelope but a 4xx/5xx status code and a `message`:

```json
{
  "code": 400,
  "message": "Order not found",
  "data": {}
}
```

Throwing `new ApiError(httpStatus.X, "msg")` in a service is the canonical way to surface a user-friendly error.

## Sockets

The Socket.IO server runs on **port 8181** (same Node process). Auth is JWT handshake.

Events the frontend listens for:
- `new-message`, `new-message-self`, `new-chat`
- `freelancer-notification::<userId>` / `buyer-notification::<userId>` / `admin-notification::admin`
- `auth/force-logout`

Backend sends notifications via `services/notification.service.js → addCustomNotification(eventName, userId, body)` — it both persists a `Notification` row and emits the socket event in one call.
