// Live Socket.IO connection for the admin panel.
// Joins the backend "admins" room (via verified JWT) so risk flags and
// admin notifications arrive without polling.
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { socketUrl } from "../baseUrl";

export default function useAdminSocket({ onRiskFlag, onNotification } = {}) {
  const [connected, setConnected] = useState(false);
  const handlers = useRef({ onRiskFlag, onNotification });
  handlers.current = { onRiskFlag, onNotification };

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    if (!token) return undefined;
    const s = io(socketUrl, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 8,
    });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("admin-risk-flag", (payload) => handlers.current.onRiskFlag?.(payload));
    s.on("admin-notification", (payload) => handlers.current.onNotification?.(payload));
    s.on("admin-notification::admin", (payload) => handlers.current.onNotification?.(payload));
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  return { connected };
}
