# Frontend guide (`frontend/`)

Next.js 16.2.6 App Router, React 19, JavaScript (no TS). Tailwind for styling. Redux Toolkit + RTK Query for state and data. Runs on port 8000.

## Folder map

```
frontend/
├── app/
│   ├── (auth)/             route group — sign-in, sign-up, verify-email, etc.
│   ├── (others)/           route group — misc public pages
│   ├── [username]/         dynamic public profile route (server component)
│   ├── dashboard/          seller dashboard pages
│   ├── inbox/              DM inbox + /inbox/[chatId]
│   ├── order/[orderId]/    order detail page
│   ├── gig/                gig list + detail + add/edit
│   ├── redux/
│   │   ├── api/baseApi.js  shared RTK-Query slice
│   │   ├── features/       one file per area, injectEndpoints into baseApi
│   │   ├── slices/         classic Redux slices (e.g. userSlice)
│   │   ├── provider.js     <ReduxProvider> wrapper
│   │   └── store.js
│   ├── layout.js           root layout (Providers + SocketProvider + Toaster)
│   ├── page.js             homepage
│   └── not-found.js
├── components/             folder-per-feature (Profile/, Order/, Inbox/, …)
├── hooks/
│   ├── useUser.js          decodes accessToken cookie → user object
│   └── …
├── lib/
│   ├── constant.js         baseUrl / siteName / imgUrl re-export
│   └── config.js
├── utils/                  formatTimestamp, getImageUrl, jwt, etc.
├── actions/                next/server actions (login, register)
├── middleware.js           edge route gate (Next 16 wants this renamed to proxy.js)
├── next.config.mjs
├── tailwind.config.js
└── .env.example
```

## Conventions

### Language + tooling
- **JavaScript only.** No `.ts` / `.tsx`.
- **App Router only.** No `pages/`.
- **Tailwind**. No CSS-in-JS, no module CSS for new files.
- Path alias `@/` → frontend root (`jsconfig.json`).

### Next.js 16 specifics
- **`params` is async** in dynamic routes — `const { foo } = await params;` before destructuring.
- **`middleware.js` is deprecated** — Next 16 wants `proxy.js`. The current file is functionally fine, but emits a startup warning. Rename when convenient (no other behaviour changes).
- **Turbopack** is the default dev bundler. Use it (`next dev -p 8000`) — Webpack flags are unsupported.

### Server vs client components
- Server components are the default. Use them whenever possible — they're faster and lighter.
- Mark a file `"use client"` only when you need hooks, browser APIs, event handlers, or interactive state.
- A typical pattern: a server-component page that fetches data on the server and passes it to a client-component renderer (`app/[username]/page.js` is a clean example).

### Auth
- **Access token** is a cookie named `accessToken`. Value is a JSON-stringified token string. Set on sign-in by `components/SignIn/SignIn.js`.
- **`useUser()` hook** decodes the token client-side via `jwt-decode` and returns a `user` object or `null`.
- **Edge gating** lives in `middleware.js` — prefix-matched protected paths bounce unauth to `/sign-in?from=<original>`. After login, `SignIn.js` honours `?from=` and routes back. **`JWT_SECRET` must match the backend's** or every signed-in request gets bounced.
- To add a new protected path, add its prefix to the `PROTECTED_PREFIXES` list in `middleware.js`.

### Redux Toolkit Query
The shared API slice is `app/redux/api/baseApi.js`. Feature slices inject into it:

```js
import { baseApi } from "../../api/baseApi";

export const disputeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    openDispute: builder.mutation({
      query: (body) => ({ url: "/disputes", method: "POST", body }),
      invalidatesTags: ["Orders", "Disputes"],
    }),
    getMyDisputes: builder.query({
      query: ({ status, page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        return { url: "/disputes/my", method: "GET", params };
      },
      transformResponse: (data) => data?.data?.attributes,
      providesTags: ["Disputes"],
    }),
  }),
});

export const { useOpenDisputeMutation, useGetMyDisputesQuery } = disputeApi;
```

Always:
- **Strip the envelope** with `transformResponse: (data) => data?.data?.attributes`.
- **Tag-invalidate** so list views refresh after mutations. Add the tag to `baseApi.tagTypes` first.
- **Use `params` (URLSearchParams)** for query strings, not template literals — RTK-Query encodes them for you.
- **`useUser()` → `Cookies.get("accessToken")`** — the token flows through `baseApi.prepareHeaders`. You don't need to attach headers manually.

### Toasts + modals
- Toasts: `import { toast } from "sonner"` → `toast.success("...")` / `toast.error("...")`.
- Modals: antd `Modal`. Dropdowns: antd `Dropdown` with `dropdownRender` for custom panels.
- Confirmations for destructive actions: native `confirm(...)` or sweetalert2 (existing pattern).

### Realtime (Socket.IO client)
- `useSocket()` from `components/Context/SocketProvider.js` returns `{ socket }`.
- Listen with `socket.on(eventName, handler)` inside a `useEffect`. Clean up with `socket.off(...)` in the return.
- Common events:
  - `new-message`, `new-message-self`, `new-chat` — inbox
  - `freelancer-notification::<userId>` / `buyer-notification::<userId>` / `admin-notification::admin` — notifications
  - `auth/force-logout` — admin banned this user; clear cookies and bounce to `/sign-in?banned=<reason>`

### Styling
- Tailwind. Emerald-600 (`emerald-500/600/700`) is the primary brand colour.
- Status pills use this pattern (see `OrderDetails.js`):
  ```js
  const STATUS_STYLE = {
    active:    { label: "In progress", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    delivered: { label: "Delivered",   dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-700 border-sky-100" },
    // ...
  };
  ```
- Sticky right-rail layout (e.g. profile page, order detail): `grid grid-cols-1 md:grid-cols-12 gap-6` with a `md:col-span-8` left and `md:col-span-4` right; on the right, wrap content in `<div className="md:sticky md:top-20">`.

### File uploads
- All images route to **ImgBB** via the backend. There's no local-disk path.
- For multi-part uploads use `FormData` + RTK-Query mutation (no `Content-Type` header — the browser sets the boundary).

## How to add a new page

1. Create `app/<route>/page.js`. Server component by default.
2. If the page needs auth, add its prefix to `middleware.js` `PROTECTED_PREFIXES`.
3. If it has dynamic params, **`await params`** before destructuring.
4. Pull data with a server-side `fetch` (no-store) or pass an `id` to a client child that uses an RTK-Query hook.
5. Wrap with `<PrimaryLayout>` for navbar+footer; skip for full-bleed pages (e.g. /inbox).
6. Add nav entries if it's a top-level page (`components/Layout/Navbar.js`).

## Common pitfalls

- **Forgetting `await params`** in dynamic routes — manifests as `Cannot read properties of undefined (reading 'foo')`.
- **Adding an RTK-Query tag without registering it** — `tagTypes` in `baseApi.js` must include the tag, or `invalidatesTags`/`providesTags` no-op.
- **Listening to a socket event without cleanup** — causes duplicate handlers after every nav. Always return a cleanup from the `useEffect`.
- **Hardcoding `http://localhost:7171`** — use `@/lib/constant` (`base`, `baseUrl`).
- **Mixing `from` and `redirect` query params** — sign-in only honours `?from=`. The `ContactButton` uses `from` for this reason.
