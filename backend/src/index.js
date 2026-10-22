const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config/config");
const logger = require("./config/logger");

// Bind host. When BACKEND_IP is unset or empty we bind to all interfaces
// (0.0.0.0) — required for local dev, Docker, and most PaaS setups.
const bindHost = config.backendIp || "0.0.0.0";

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info("Connected to MongoDB");
  // Auto-complete ignored deliveries and flag late orders.
  require("./services/orderLifecycle.service").startHousekeeping();
  server = app.listen(config.port, bindHost, () => {
    logger.info(`Listening on http://${bindHost}:${config.port}`);
  });
});

// Start the socket server on a different port
const { initSocket } = require("./socket/socketServer");
initSocket();

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

// uncaughtException leaves the process in an undefined state per Node docs,
// so we close and exit. unhandledRejection is usually a missed `.catch()` on
// a one-off async call (an SMTP failure, a stale cache fetch) — log it and
// keep serving. Crashing the whole API on a single bad promise is a
// reliability foot-gun.
process.on("uncaughtException", (error) => {
  logger.error("uncaughtException:", error);
  exitHandler();
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection:", reason);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) {
    server.close();
  }
});
