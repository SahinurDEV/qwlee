# CLAUDE.md

Project guide loaded automatically by Claude Code at session start. Read this first.

## What this repo is

**Qwlee** — a three-app freelance services marketplace (Fiverr-style). Originally branded `cnnctr`. The PRD for the full vision lives at `new-PRD-marketplace.md`. The implemented surface area is documented in `README.md`.

| App | Stack | Port | Folder |
|---|---|---|---|
| Backend API + Socket.IO | Express 4 / Mongoose 8 / Socket.IO | 7171 (REST) + 8181 (socket) | `backend/` |
| Marketplace web | Next.js 16 (App Router, JS) + React 19 + Redux Toolkit | 8000 | `frontend/` |
| Admin dashboard | Vite 5 + React 18 + react-router-dom | 4000 | `admin/` |

MongoDB runs on `mongodb://localhost:27017/cnnctr`.

## Quickstart for a new Claude session

```sh
# Check MongoDB is up
lsof -iTCP:27017 -sTCP:LISTEN -nP

# Start all three apps (each in the background)
cd /Users/sahinur/Desktop/fiverr-clone/backend  && npm run dev   # 7171 + 8181
cd /Users/sahinur/Desktop/fiverr-clone/frontend && npm run dev   # 8000
cd /Users/sahinur/Desktop/fiverr-clone/admin    && npm run dev   # 4000

# Quick health check
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7171/v1/categories
```

Demo logins (after `npm run seed` in `backend/`):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Seller | `seller@example.com` | `Seller123!` |
| Buyer | `buyer@example.com` | `Buyer123!` |

## Repo map at a glance

```
.
├── backend/                 Express API + socket
│   ├── src/
│   │   ├── config/          dotenv-gated config, logger, response helper, roles
│   │   ├── controllers/     thin — call services, shape response
│   │   ├── services/        all business logic + Mongoose access
│   │   ├── models/          Mongoose schemas (export aggregated in models/index.js)
│   │   ├── routes/v1/       Express routers mounted under /v1
│   │   ├── middlewares/     auth (passport-jwt), error handler, multer
│   │   ├── socket/          Socket.IO server (port 8181)
│   │   ├── validations/     Joi schemas
│   │   ├── utils/           ApiError, catchAsync, pick, etc.
│   │   ├── docs/            swagger-jsdoc definitions
│   │   ├── app.js           Express app wiring
│   │   └── index.js         Bootstraps Mongoose + http + socket
│   ├── seeders/             `npm run seed` entrypoint (--reset / --only=…)
│   └── .env                 see backend/.env.example
├── frontend/                Next.js 16 App Router (JS, not TS)
│   ├── app/
│   │   ├── (auth)/          sign-in / sign-up / verify-email / etc.
│   │   ├── (others)/        misc public pages
│   │   ├── [username]/      public profile route (server component)
│   │   ├── dashboard/       seller dashboard
│   │   ├── inbox/           DM inbox + /inbox/[chatId]
│   │   ├── order/[orderId]/ order detail page
│   │   ├── redux/           store + RTK-Query slices in features/
│   │   └── layout.js / page.js
│   ├── components/          UI; folder-per-feature
│   ├── hooks/               useUser, useSocket, etc.
│   ├── lib/constant.js      env-derived baseUrl + siteName
│   ├── middleware.js        edge route-gate (deprecated by Next 16 — rename to proxy.js when convenient)
│   └── .env / .env.example
├── admin/                   Vite + React 18 SPA
│   ├── src/
│   │   ├── router/Route.jsx Router config — register new pages here
│   │   ├── dashboard/
│   │   │   ├── layout/      DashboardLayout + Sidebar + Header
│   │   │   ├── menu/        one page per file (Orders.jsx, Disputes.jsx, …)
│   │   │   └── auth/        Login / OTP / etc.
│   │   ├── common/          Card, Button, PageHeader, StatusPill, DataTable
│   │   ├── redux/api/       apiSlice.js — single shared RTK-Query slice
│   │   └── utils/           cls, format, getImageUrl
│   └── .env / .env.example
├── docs/                    Developer docs (read these for deep dives)
├── README.md                Feature inventory
└── new-PRD-marketplace.md   The product spec we're building toward
```

## Conventions (apply unless told otherwise)

### Backend
- **Layers**: route → controller (`catchAsync`) → service (throws `ApiError`) → model. Controllers must stay thin — no DB calls.
- **Routes** mount in `src/routes/v1/index.js`. Use `auth("admin"|"freelancer"|"buyer"|"common"|"withOutAdmin")` from `middlewares/auth`.
- **Models** export via `src/models/index.js`. Always add `paginate` plugin if the entity is listed.
- **Responses** wrap with `config/response.js` — payloads land at `data.attributes` on the client. Don't unwrap manually; let RTK-Query slices do it via `transformResponse`.
- **Errors** throw `new ApiError(httpStatus.X, "...")` — never `throw new Error`.
- **No console.log** in committed code — use `config/logger.js`.
- **Notifications**: prefer `addCustomNotification(eventName, userId, body)` — it emits a socket event AND persists.

### Frontend (Next.js 16)
- **JavaScript, not TypeScript.** App Router only.
- **Dynamic `params` are async** — `const { foo } = await params;` in server components.
- Use `@/` path alias (`jsconfig.json`).
- **Redux Toolkit Query** for every API call. Inject endpoints into the shared `baseApi` in `app/redux/api/baseApi.js`. Strip the response envelope with `transformResponse: (data) => data?.data?.attributes`.
- **Auth token** lives in the `accessToken` cookie (JSON-stringified). `baseApi` reads + attaches it. JWT decoded client-side via `jwt-decode` in `hooks/useUser.js`.
- **Auth-gated routes**: add to `frontend/middleware.js` (prefix list). Redirects to `/sign-in?from=<path>`.
- **Toasts** via `sonner` (`import { toast } from "sonner"`).
- **UI primitives**: antd Modal/Dropdown, raw Tailwind for everything else. Emerald-600 = primary.
- **No emojis in committed code or docs** unless the user explicitly asks.

### Admin
- **React 18 + react-router-dom v6**. Plain JSX.
- All API endpoints live in `src/redux/api/apiSlice.js` (one giant slice). Add a new endpoint there, then a hook export at the bottom.
- Common primitives: `common/Card.jsx`, `common/Button.jsx`, `common/PageHeader.jsx`, `common/StatusPill.jsx`. Use them — don't reinvent.
- Pages live in `src/dashboard/menu/` and register in `src/router/Route.jsx` + a sidebar entry in `src/dashboard/layout/Sidebar.jsx`.
- **`toast` from `react-hot-toast`** (different from the marketplace's `sonner`).
- Auth token in `localStorage.getItem('token')`. Every endpoint manually sets `authorization: Bearer …`.

## Running commands

- Three apps are typically started in the background with `npm run dev` in each folder.
- Backend uses `nodemon` — code changes auto-reload.
- Frontend (Next 16) uses Turbopack — Fast Refresh handles most edits.
- Admin (Vite) uses HMR.
- Tail logs via `tail -f /tmp/qwlee-*.log` if you redirect there.

## Environment variables

See `*/​.env.example`. Critical ones:

- `backend/.env`: `MONGODB_URL`, `JWT_SECRET` (≥ 16 chars, **must match `frontend/.env`'s `JWT_SECRET`** because the edge middleware verifies tokens), `NODE_ENV`, `PORT=7171`, `IMGBB_API_KEY`, optional Stripe TEST keys.
- `frontend/.env`: `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:7171`, `NEXT_PUBLIC_SOCKET_URL=http://localhost:8181`, `JWT_SECRET` (matching), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `admin/.env`: `VITE_API_BASE_URL=http://localhost:7171`.

⚠️ **Live secrets incident** — historically `backend/.env` shipped with committed live Stripe/Cloudinary/Gmail keys. Always treat the file as sensitive; rotate, don't grep & share.

## Do / don't

✅ Do:
- Run all three apps before claiming a feature works end-to-end. Backend-only smoke tests miss UI breakage.
- Prefer adding a service method over fattening a controller.
- When extending a Mongoose enum, also update the orders-status places that mirror it: `orders.service.js` `STATUS_KEYS`, the `OrderDetails.js` `STATUS_STYLE`, the admin Orders page status filter.
- Match the existing folder's naming convention exactly (`*.service.js`, `*.controller.js`, `*.routes.js`, `*.model.js`).
- Add the `disputed` model lookup pattern when wiring new notifications: notify the counterparty by role, and the admin channel via `addCustomNotification("admin-notification", "admin", body)`.

❌ Don't:
- Introduce TypeScript anywhere.
- Add new top-level folders without checking — there's almost always an existing home.
- Modify `backend/.env` casually — it has historically held live credentials.
- Force-push, amend published commits, or skip pre-commit hooks.
- Add emojis or filler comments. Comments explain *why*, not *what*.

## Deferred / known issues

- `frontend/middleware.js` triggers a Next.js 16 deprecation warning ("rename to proxy.js"). Functionally fine; rename is cosmetic.
- Two parallel order schemas exist (`orders.model.js` and `payment.model.js`). **`Payment` is canonical** — most services use it. `Orders` is vestigial; keep enums in sync but new features should target `Payment`.
- Several controllers aren't aggregated in `controllers/index.js` — they're required directly in routes. Match the route file's existing style when you add one.

## Where to read next

- `docs/ARCHITECTURE.md` — system shape, data flow, ports, auth
- `docs/CONTRIBUTING.md` — setup, branching, PR conventions
- `docs/BACKEND.md` — how to add an endpoint / model / service
- `docs/FRONTEND.md` — Next.js 16 + Redux patterns
- `docs/ADMIN.md` — Vite + react-router patterns
- `docs/API.md` — REST surface + swagger
- `README.md` — exhaustive feature inventory (what's already shipped)
- `new-PRD-marketplace.md` — long-form product spec (what we're building toward)
