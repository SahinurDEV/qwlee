// Socket.IO gateway. Handles real-time presence + message events.
//
// Auth: we accept a JWT in the handshake `auth.token`. If present and
// verified, the socket is bound to that userId and presence updates run
// server-side. The legacy `user/connect` event with a client-supplied
// userId is still honored (for backwards compatibility with the existing
// frontend) but verified payloads take precedence.

const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const express = require("express");
const config = require("../config/config");
const userEvents = require("./events/user");
const presence = require("./presence");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  // Same allowlist as the REST API (CORS_ORIGINS). Falls back to any
  // origin only when no allowlist is configured (local development).
  cors: { origin: config.corsOrigins.length ? config.corsOrigins : "*" },
  allowEIO3: true,
  perMessageDeflate: false,
});

const PORT = Number(process.env.SOCKET_PORT) || 8181;

io.use((socket, next) => {
  // Best-effort JWT verification. We don't fail unauthenticated sockets —
  // public features (e.g. live presence read) work without auth — but
  // authenticated sockets get a verified userId.
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next();
  try {
    const cleaned = String(token).replace(/^"(.*)"$/, "$1");
    const payload = jwt.verify(cleaned, config.jwt.secret);
    if (payload?.type === "access" && payload.sub) {
      socket.verifiedUserId = String(payload.sub);
    }
  } catch (_) {
    // Invalid token → continue as anonymous.
  }
  next();
});

// Maintenance mode also pauses chat: non-admin sockets are refused at
// connect time and any event they send while it is on gets an error
// instead of being handled. Admin sockets keep working.
const siteSettings = require("../services/siteSettings.service");
const maintenanceOn = async () => {
  try { return !!(await siteSettings.get()).maintenance?.enabled; } catch { return false; }
};
const isAdminSocket = async (socket) => {
  if (!socket.verifiedUserId) return false;
  if (socket.isAdmin !== undefined) return socket.isAdmin;
  try {
    const User = require("../models/user.model");
    const u = await User.findById(socket.verifiedUserId, "role").lean();
    socket.isAdmin = u?.role === "admin";
  } catch { socket.isAdmin = false; }
  return socket.isAdmin;
};
io.use(async (socket, next) => {
  if ((await maintenanceOn()) && !(await isAdminSocket(socket))) {
    const err = new Error("MAINTENANCE");
    err.data = { maintenance: true };
    return next(err);
  }
  next();
});

io.on("connection", async (socket) => {
  socket.use(async (packet, next) => {
    if ((await maintenanceOn()) && !(await isAdminSocket(socket))) {
      socket.emit("maintenance", { enabled: true });
      return next(new Error("MAINTENANCE"));
    }
    next();
  });

  // If the handshake carried a verified user, bind presence immediately.
  if (socket.verifiedUserId) {
    socket.userId = socket.verifiedUserId;
    socket.join(socket.userId);
    await presence.addConnection(socket.userId, socket.id);
    socket.broadcast.emit("user/connect", socket.userId);
  }

  // Legacy chat / order-message handlers + the existing user/connect
  // event for clients that still send userId manually.
  userEvents(socket);

  socket.on("presence/ping", () => {
    // Lightweight echo so clients can detect a stale connection.
    socket.emit("presence/pong", { online: presence.isOnline(socket.userId) });
  });

  // Typing relay — sender emits `typing/start` / `typing/stop` with
  // { chatId, receiverId }. We forward to the receiver's userId room so
  // only the intended counterparty sees the indicator. Server signs the
  // payload with the verified senderId so a malicious client can't
  // spoof someone else's typing state.
  function relayTyping(eventName) {
    return (payload = {}) => {
      const receiverId = String(payload?.receiverId || "");
      if (!receiverId) return;
      const senderId = socket.userId || socket.verifiedUserId;
      if (!senderId) return;
      io.to(receiverId).emit(eventName, {
        chatId: payload?.chatId || null,
        senderId,
      });
    };
  }
  socket.on("typing/start", relayTyping("typing/start"));
  socket.on("typing/stop", relayTyping("typing/stop"));

  socket.on("disconnect", async () => {
    if (socket.userId) {
      const res = await presence.removeConnection(socket.userId, socket.id);
      if (res?.wentOffline) {
        socket.broadcast.emit("user/disconnect", socket.userId);
      }
    }
  });
});

server.listen(PORT, () => {
  logger.info(`Socket server is running on port ${PORT}`);
});

const initSocket = () => {
  logger.info("Socket server initialized");
};

module.exports = { initSocket, io, presence };
