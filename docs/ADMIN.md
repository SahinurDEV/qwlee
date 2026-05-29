# Admin guide (`admin/`)

Vite 5 + React 18 SPA. Plain JSX. Runs on port 4000. **Different stack from the marketplace** — react-router-dom, react-hot-toast, manual `Authorization` headers, localStorage for the token.

## Folder map

```
admin/src/
├── main.jsx                 ReactDOM bootstrap
├── App.jsx                  RouterProvider + ReduxProvider
├── router/
│   ├── Route.jsx            createBrowserRouter — register every page here
│   ├── AdminRoute.jsx       gate that bounces non-admins to /
│   └── PublicRoute.jsx      reverse gate (logged-in admins skip /)
├── dashboard/
│   ├── layout/
│   │   ├── DashboardLayout.jsx   shell: <Sidebar/> + <Outlet/>
│   │   ├── Sidebar.jsx           NAV array drives links; add an item to add a nav row
│   │   └── Header.jsx
│   ├── menu/                One page per file (Orders.jsx, Disputes.jsx, …)
│   └── auth/                Login, OtpVerify, Forgotpassword, UpdatePassword
├── dashboardHome/           Dashboard landing components
├── common/                  Button, Card, PageHeader, StatusPill, DataTable, Avatar, Kpi
├── utils/                   cls, format, getImageUrl
├── redux/
│   ├── api/apiSlice.js      ONE giant RTK-Query slice — add endpoints here
│   └── store.js
├── baseUrl.js               reads VITE_API_BASE_URL
└── index.css / App.css / main.css
```

## Conventions

### Language + tooling
- **React 18** + plain JSX (`.jsx`).
- **react-router-dom v6** for routing.
- **react-hot-toast** for toasts (`toast.success(...)` / `toast.error(...)`). Marketplace uses `sonner` — don't mix them.
- **Tailwind**. Most pages also lean on small primitives in `src/common/`.
- **react-icons** for icons. Stick to one set per area where possible (e.g. `react-icons/io5` on most pages).

### Auth + API calls
- Token lives in `localStorage` under `"token"`. Saved by `dashboard/auth/Login.jsx` on successful sign-in. Cleared on sign-out (handled by `Sidebar`'s logout button).
- Every endpoint **manually** attaches `Authorization: Bearer ${localStorage.getItem("token")}`. There's no `prepareHeaders` indirection like the marketplace has.
- Pattern for a new endpoint (in `src/redux/api/apiSlice.js`):
  ```js
  getAdminDisputes: builder.query({
    query: ({ status, page = 1, limit = 50 } = {}) => {
      const qs = new URLSearchParams({ limit, page });
      if (status) qs.append("status", status);
      return {
        url: `/disputes?${qs.toString()}`,
        headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
      };
    },
    transformResponse: (res) => res?.data?.attributes,
    providesTags: ["disputes"],
  }),
  ```
- Add the tag to the `tagTypes` array at the top of `apiSlice.js` before using it.
- Export the generated hook at the bottom of the file (one giant export block).

### Adding a new page

1. **Create the page** — `src/dashboard/menu/Disputes.jsx`. Compose from `common/PageHeader`, `common/Card`, `common/Button`, `common/StatusPill`. Don't roll your own surface or button — they exist.
2. **Register the route** — add an import + route entry to `src/router/Route.jsx`:
   ```js
   import Disputes from "../dashboard/menu/Disputes";
   // ...
   { path: "disputes", element: <Disputes /> },
   ```
3. **Sidebar entry** — add to the appropriate group in `src/dashboard/layout/Sidebar.jsx`:
   ```js
   { to: "/dashboard/disputes", label: "Disputes", icon: TbFlag },
   ```
4. **Add API endpoints** — extend `src/redux/api/apiSlice.js` (single slice for the whole app).

### Common primitives

Live in `src/common/`. Always check before rolling your own.

| Component | Purpose |
|---|---|
| `PageHeader` | Title + subtitle + optional actions slot |
| `Card` | White surface (border, rounded-2xl, shadow). Optional `title` / `subtitle` / `actions`. `bodyClassName="p-0"` for list views. |
| `Button` | `variant: primary|secondary|danger|ghost`, `size: sm|md|lg`, `loading`, `iconLeft` / `iconRight` |
| `StatusPill` | Tone-mapped status badge. Pass `status="approved|pending|error|info|active|delivered|completed|late|cancelled|muted"` |
| `DataTable` | Tabular list with sticky header |
| `Avatar` | Round avatar with name-derived fallback |
| `Kpi` | Stat tile for dashboards |

### Forms + lists

- Search-on-the-list: keep a `search` state, filter `items` in a `useMemo`. No debounce unless the dataset is huge — admin pages have small result sets.
- Tabs: keep tab state in the page, drive `useGetXQuery({ status: tab })`. The query refetches on arg change automatically.

## Common pitfalls

- **Forgetting to add the tag to `tagTypes`** — `invalidatesTags` will no-op.
- **Using `sonner`** — wrong toast lib for this app. Use `react-hot-toast`.
- **Hardcoding `http://localhost:7171`** — use `baseUrl` from `src/baseUrl.js` (it's joined with `/v1` automatically inside `apiSlice.js`).
- **Adding a page but forgetting the sidebar entry** — the route loads but is unreachable from the nav.
- **Not adding the `AdminRoute` guard** — non-admins shouldn't see the page. The dashboard layout is already gated, so just nest inside the `path: "dashboard"` block.

## Build + deploy

```sh
cd admin
npm run build    # vite build → dist/
npm run start    # vite preview (production preview server)
```

Lint:

```sh
npm run lint     # eslint --max-warnings 0
```
