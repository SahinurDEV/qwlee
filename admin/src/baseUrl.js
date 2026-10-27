// Backend API base URL. Set VITE_API_BASE_URL in `.env` (see `.env.example`).
// Falls back to localhost so a missing env file in dev still works; for
// production, the env var must be set or the bundle will hit the dev port.
const url =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:7171';

export default url;

// Public marketplace URL (for "open on site" links).
export const frontendUrl = (import.meta.env.VITE_FRONTEND_URL || "http://localhost:8000").replace(/\/+$/, "");

// Socket.IO URL for live admin notifications (risk flags, etc.).
export const socketUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8181")
  .replace(/\/api\/?$/, "")
  .replace(/\/+$/, "")
  .replace(/:7171$/, ":8181");
