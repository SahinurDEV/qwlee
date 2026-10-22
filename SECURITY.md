# Security Policy

## Reporting a vulnerability

Please do not open public issues for security problems. Use GitHub's private reporting: **Security > Report a vulnerability** on this repository. Include steps to reproduce and the affected version or commit.

You can expect an acknowledgement within 7 days. Fixes are released on `main`.

## Supported versions

Only the latest `main` branch is supported.

## Deployment notes

- Always set a strong, unique `JWT_SECRET`.
- Use Stripe test keys outside production and never commit any `.env` file.
- Do not expose MongoDB to the public internet.
