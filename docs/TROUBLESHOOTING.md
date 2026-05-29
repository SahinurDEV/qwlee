# Troubleshooting

## "Config validation error" on backend boot

The backend Joi-validates env at boot (`backend/src/config/config.js`). If you see e.g. `Config validation error: "JWT_SECRET" length must be at least 16 characters long`, your `backend/.env` is missing or short on a required key.

Fix: copy `.env.example` and fill in every required value (see [CONTRIBUTING.md](./CONTRIBUTING.md#fill-in-env-files)).

## All authed pages bounce me to `/sign-in?from=…` even after logging in

The frontend's edge middleware (`middleware.js`) verifies the JWT signature with `JWT_SECRET` from `frontend/.env`. If that secret doesn't match the backend's, every signed-in request fails the verify and bounces.

Fix: set `JWT_SECRET` to the same value in **both** `backend/.env` and `frontend/.env`. Restart both dev servers.

## `Cannot read properties of undefined (reading '<field>')` in a dynamic route

Next.js 16 made dynamic-route `params` async. The route must `await` it before destructuring:

```js
// before
export default function Page({ params }) {
  const { orderId } = params;   // ← undefined in Next 16
}

// after
export default async function Page({ params }) {
  const { orderId } = await params;
}
```

## "The 'middleware' file convention is deprecated. Please use 'proxy' instead."

This is a Next.js 16 startup warning, not an error. `frontend/middleware.js` still works. Renaming it to `proxy.js` silences the warning. Defer if you have other priorities.

## RTK-Query `injectEndpoints` HMR warning ("called `injectEndpoints` to override already-existing endpointName")

Dev-only warning that shows up when Next.js hot-reloads a slice file. It's harmless; the duplicate registration is dropped. Resolves on a full page reload.

## `EADDRINUSE: address already in use :::7171` (or 8000 / 4000 / 8181)

Another process is on the port — usually a previous dev server you forgot to stop, or the macOS AirPlay receiver on 5000 (different port, same lesson).

Fix:

```sh
lsof -iTCP:7171 -sTCP:LISTEN -nP   # find the PID
kill -9 <PID>
```

Or run with a different port (won't help for the frontend, since `NEXT_PUBLIC_BACKEND_API_URL` is hardcoded).

## MongoDB connection fails on startup

Symptoms: `MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`.

Fix: start MongoDB.

```sh
# macOS (Homebrew)
brew services start mongodb-community

# Verify
lsof -iTCP:27017 -sTCP:LISTEN -nP
```

## Admin page renders but the API returns 401

The admin token lives in `localStorage.getItem("token")` and is attached to every request manually. If you signed in and still get 401s, check the browser DevTools → Application → Local Storage → http://localhost:4000 for the `token` key. If it's missing or contains a stale value, sign out and back in.

## Socket events not firing

- Check `NEXT_PUBLIC_SOCKET_URL` is set in `frontend/.env`. It should be `http://localhost:8181` in dev.
- Check the browser console for `socket connect_error` — usually a CORS or auth failure.
- Check the backend log — the handshake throws `unauthorized` if the JWT is invalid.

## Image upload fails

All uploads go through ImgBB. The backend forwards the file with `IMGBB_API_KEY`. If `IMGBB_API_KEY` is empty or wrong in `backend/.env`, every upload returns 400.

## "There is already a chat between these participants" / chat doesn't open

`POST /v1/chat/add-chat` is **get-or-create**. If it returns the existing chat, the response contains the chat object — frontend should pull the id and route to `/inbox/<chatId>`. The `ContactButton` component does this correctly; copy that pattern.

## Order status shows up incorrectly in the admin / frontend

The order status enum is mirrored in **three** places. If you added a new state and only updated one, the other two get out of sync.

Fix: update all three —
1. `backend/src/models/payment.model.js` (canonical)
2. `backend/src/models/orders.model.js` (vestigial twin)
3. `backend/src/services/orders.service.js` `STATUS_KEYS`

And on the client, add a tone to `STATUS_STYLE` in `frontend/components/Order/OrderDetails/OrderDetails.js`.

## Stripe webhook isn't firing in dev

Run `stripe listen --forward-to localhost:7171/v1/orders/webhook` and copy the printed signing secret into `backend/.env` as `STRIPE_WEBHOOK_SECRET`. Restart the backend.

## "Live secrets" warning

Historically `backend/.env` shipped with live Stripe/Cloudinary/Gmail keys committed to the repo. Always treat `backend/.env` as sensitive — assume any secret you see in it may be in the public git history. **Rotate** before relying on it in production.

## I broke something — how do I get back to a clean state?

```sh
git status                  # see what changed
git stash                   # park changes
# verify the apps work again on `main`
# then pop the stash to compare:
git stash pop
```

For data: drop the database and re-seed.

```sh
mongosh
  use cnnctr
  db.dropDatabase()
  exit
cd backend && npm run seed
```
