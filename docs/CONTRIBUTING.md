# Contributing to Qwlee

Welcome. This is the on-ramp for any developer joining the project.

## Prerequisites

- Node.js ≥ 20 (tested with 21.7)
- MongoDB ≥ 6 running locally — `brew services start mongodb-community` on macOS
- A code editor (VS Code recommended)

## First-time setup

```sh
git clone <repo-url> qwlee && cd qwlee

# Install dependencies (parallel friendly)
cd backend  && npm install && cp .env.example .env
cd ../frontend && npm install && cp .env.example .env
cd ../admin    && npm install && cp .env.example .env
cd ..
```

### Fill in `.env` files

Critical (won't start without these):

**`backend/.env`** — `MONGODB_URL`, `JWT_SECRET` (≥ 16 chars), `NODE_ENV=development`, `PORT=7171`, `IMGBB_API_KEY`. Optional Stripe TEST keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).

**`frontend/.env`** — `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:7171`, `NEXT_PUBLIC_SOCKET_URL=http://localhost:8181`, `JWT_SECRET` **identical** to `backend/.env`'s value (edge middleware uses it to verify tokens), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`.

**`admin/.env`** — `VITE_API_BASE_URL=http://localhost:7171`.

### Seed demo data

```sh
cd backend && npm run seed
```

This drops and re-seeds every collection (28 users, 17 gigs, 28 orders, reviews, withdrawals, support tickets, etc.). The seeder prints three sample `/order/<id>` URLs at the end.

Demo logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Seller | `seller@example.com` | `Seller123!` |
| Buyer | `buyer@example.com` | `Buyer123!` |

## Running the three apps

Three terminals:

```sh
cd backend  && npm run dev   # http://localhost:7171  + socket :8181
cd frontend && npm run dev   # http://localhost:8000
cd admin    && npm run dev   # http://localhost:4000
```

Health check:

```sh
curl -s http://localhost:7171/v1/categories | head -c 200
```

## Branching + commits

- **Branch name**: `feat/<short-description>`, `fix/<short-description>`, `docs/<…>`, `chore/<…>`.
- **One feature per PR.** Don't bundle unrelated changes.
- **Commit messages** follow the recent project style (see `git log`): a single concise lower-case present-tense line. Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `docs:`) are welcome but not required.
- **Never** commit `.env` files. They're git-ignored — keep it that way.
- **Never** commit `node_modules/`, build output, or `dist/`.
- **No `console.log`** in committed code. Use `backend/src/config/logger.js` for backend or remove it from frontend/admin before pushing.

## Code conventions

The full convention list lives in [CLAUDE.md](../CLAUDE.md) and is repeated per-app in [BACKEND.md](./BACKEND.md), [FRONTEND.md](./FRONTEND.md), [ADMIN.md](./ADMIN.md). The headlines:

- **No TypeScript.** Plain JS (`.js`/`.jsx`) everywhere.
- **No emojis** in code, comments, or docs unless the user explicitly asks for them.
- **Don't add backwards-compatibility shims** for code that hasn't shipped yet. Just change it.
- **Comments** explain *why*, not *what*. A one-line comment that summarizes intent or warns about a non-obvious constraint is welcome; a comment that restates the code is noise.
- **Don't add error handling for impossible cases.** Trust internal calls and framework guarantees. Only validate at system boundaries (incoming HTTP, external APIs).
- **Tailwind classes only.** No CSS-in-JS, no module CSS for new files.
- **Match the existing folder's conventions exactly** — file naming, structure, layering.

## Pull request flow

1. Branch off `main`.
2. Make your change. Verify all three apps still start cleanly. **Visit the affected UI in the browser** — type checking is not enough.
3. Run `npm run lint` in any app you touched.
4. Open a PR with:
   - Title: concise one-liner
   - Description: what changed, why, screenshots/clips for UI changes, test plan
5. Address review feedback. Squash if requested.

## Verifying before push

For any UI work, the only way to be sure it works is to use it in the browser. The dev-loop:

```sh
# Backend running on 7171?
lsof -iTCP:7171 -sTCP:LISTEN -nP

# Frontend running on 8000?
open http://localhost:8000

# Admin running on 4000?
open http://localhost:4000
```

For backend-only changes, smoke test with `curl`:

```sh
# List endpoint
curl -s http://localhost:7171/v1/categories | head -c 500

# Authed endpoint (replace TOKEN)
curl -s -H "Authorization: Bearer TOKEN" http://localhost:7171/v1/disputes/my | head -c 500
```

## Reporting issues

- Performance/regression in a feature: open an issue with steps to reproduce, expected vs actual, screenshot, browser/version.
- Spec gaps: open an issue tagged `prd-gap` and point at the relevant section of `new-PRD-marketplace.md`.
- Security: do **not** open a public issue — email the maintainer directly.

## Need help?

- Read the doc that matches the app you're working in.
- Read the closest existing implementation — pattern-matching is a faster than reading docs.
- Ask in your team's channel.
