# Contributing to Qwlee

Thanks for helping out.

1. Fork the repo and create a branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Get it running with `docker compose up --build` or the manual setup in the README.
3. Follow the conventions in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): thin controllers, business logic in services, `ApiError` for errors, RTK Query for API calls, no `console.log`.
4. Run `npm run lint` in `frontend/` and `admin/`, and make sure `docker compose build` succeeds.
5. Never commit `.env` files or real credentials.
6. Open a pull request using the template; describe what changed and how you tested it. Link related issues.

Bugs and feature ideas go in GitHub Issues. Security problems go through [SECURITY.md](SECURITY.md), not public issues.

By contributing you agree your work is licensed under the MIT License.
