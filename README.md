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
| `IMGBB_API_KEY` | for uploads | Image uploads |
| `STRIPE_*` | for payments | Use test keys locally |
| `SMTP_*`, `EMAIL_FROM` | for email | OTP and password-reset email |

| `ENABLE_API_DOCS` | no | Serve Swagger UI at `/v1/docs` outside development |
| `PLATFORM_FEE_PERCENT` | no | Commission on completed orders (default 5). Admin can override in Settings > Misc with key `platformFeePercent` |
| `DEMO_PAYMENTS` | no | When no `STRIPE_SECRET_KEY` is set, place orders without charging (default `true` in compose). **Set to `false` in production.** |
| `AUTO_COMPLETE_DAYS` | no | Days after a delivery before the order auto-completes and escrow is released (default 3) |
| `ORDER_HOUSEKEEPING_MS` | no | Interval of the auto-complete / late-marking job (default 600000) |

Other payment providers and SMTP can also be configured from the admin panel.

### Email

Out of the box all email goes to the bundled Mailpit inbox at http://localhost:8025, so sign-up verification and password reset work without a real mail server. To send real email set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` and `EMAIL_FROM` in `.env` (or in the admin panel). If sending fails, password reset returns an error instead of pretending it worked.

### Payments with Stripe (test mode)

1. Create a free Stripe account and copy the **test** keys from https://dashboard.stripe.com/test/apikeys into `.env` as `STRIPE_SECRET_KEY` (`sk_test_...`) and `STRIPE_PUBLISHABLE_KEY` (`pk_test_...`).
2. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward webhooks: `stripe listen --forward-to localhost:7171/v1/orders/webhook`. Put the printed `whsec_...` value in `STRIPE_WEBHOOK_SECRET`.
3. `docker compose up -d --build backend`, then pay with card `4242 4242 4242 4242`, any future date and any CVC.

## Order lifecycle

1. Buyer checks out a gig package (+ optional extras) or a custom offer. Prices are always computed on the server (`POST /v1/orders/quote` previews them).
2. Payment (Stripe, or demo mode) is held in **escrow** on the order.
3. If the gig has requirement questions, the buyer answers them; the delivery clock starts then.
4. Seller delivers; buyer accepts or requests a revision (limited by the package).
5. On acceptance, or `AUTO_COMPLETE_DAYS` after delivery, escrow is released to the seller minus the platform fee. Cancellations and dispute refunds return escrow to the buyer.

Categories have one level of subcategories (`GET /v1/categories` lists top-level; `?parentId=<id>` lists one parent's subcategories; `?level=all` lists both). Admins manage them on the Categories page. The marketplace can be filtered by subcategory (`/gig?subCategory=<id>`) and delivery time (`delivery=<days>`).

Gigs support extras, FAQ, requirement questions and an optional YouTube/Vimeo/MP4 video.

After upgrading an existing database run `docker compose exec backend npm run migrate` (idempotent).

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
cd backend && API_URL=http://localhost:7171 npm test
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
