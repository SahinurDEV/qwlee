import { useMemo, useSyncExternalStore } from "react";
import Cookies from "js-cookie";

// The signed-in user lives in the `user` cookie. Reading it during render
// made the server (no cookie access here) and the browser disagree, which
// broke hydration (React #418). useSyncExternalStore renders the server
// snapshot (no user) while hydrating, then switches to the cookie value.
const listeners = new Set();
let last = typeof document !== "undefined" ? document.cookie : "";
if (typeof window !== "undefined") {
  // Cookies change on sign-in/out within the tab; poll cheaply.
  setInterval(() => {
    if (document.cookie !== last) {
      last = document.cookie;
      listeners.forEach((l) => l());
    }
  }, 1000);
}
function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => Cookies.get("user") || "";
const getServerSnapshot = () => "";

const useUser = () => {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }, [raw]);
};
export default useUser;
