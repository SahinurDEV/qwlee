const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config/config");
const logger = require("./config/logger");
const errorReporting = require("./services/errorReporting.service");
errorReporting.initFromEnv();

// Bind host. When BACKEND_IP is unset or empty we bind to all interfaces
// (0.0.0.0) — required for local dev, Docker, and most PaaS setups.
const bindHost = config.backendIp || "0.0.0.0";

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info("Connected to MongoDB");
  require("./services/emptyDbGuard").check().catch((e) => logger.error(`empty-db check failed: ${e.message}`));
  // Auto-complete ignored deliveries and flag late orders.
  require("./services/orderLifecycle.service").startHousekeeping();
  server = app.listen(config.port, bindHost, () => {
    logger.info(`Listening on http://${bindHost}:${config.port}`);

    // Payment mode: warn loudly in production when only demo checkout works.
    try {
      const pay = require("./services/paymentsConfig.service").readiness();
      if (config.env === "production" && pay.mode === "demo") {
        logger.warn(
          "DEMO_PAYMENTS=true in production — card charges are disabled. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, then DEMO_PAYMENTS=false."
        );
      } else if (pay.mode === "stripe" && !pay.webhookConfigured) {
        logger.warn("STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — checkout sessions will not create orders.");
      } else {
        logger.info(`Payments mode: ${pay.mode} (liveReady=${pay.readyForLiveCharges})`);
      }
    } catch (e) {
      logger.warn(`payments readiness: ${e.message}`);
    }

    try {
      const smtp = require("./services/smtpConfig.service").readiness();
      if (config.env === "production" && smtp.mode !== "configured") {
        logger.warn(
          `SMTP not ready for live mail (mode=${smtp.mode}). Set SMTP_HOST, SMTP_PORT, SMTP_USER/SMTP_USERNAME, SMTP_PASS/SMTP_PASSWORD, and EMAIL_FROM/SMTP_FROM.`
        );
      } else {
        logger.info(`SMTP mode: ${smtp.mode} (liveReady=${smtp.readyForLiveMail})`);
      }
    } catch (e) {
      logger.warn(`smtp readiness: ${e.message}`);
    }
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
