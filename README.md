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
- API: http://localhost:7171 (health: `/health`, docs: `/v1/docs` if enabled)

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

Other payment providers and SMTP can also be configured from the admin panel.

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
