const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const cors = require("cors");
const passport = require("passport");
const httpStatus = require("http-status");
const status = require("express-status-monitor");
const config = require("./config/config");
const morgan = require("./config/morgan");
const { jwtStrategy } = require("./config/passport");
const { authLimiter } = require("./middlewares/rateLimiter");
const routes = require("./routes/v1");
const { errorConverter, errorHandler } = require("./middlewares/error");
const ApiError = require("./utils/ApiError");

const app = express();

// Honour X-Forwarded-For headers when behind a proxy so req.ip reflects
// the real client (used for the per-user activity log).
app.set("trust proxy", true);

if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// Seed / demo images committed under backend/public/seed. Served with a
// cross-origin resource policy so the marketplace and admin (different
// origins) can embed them.
app.use(
  "/seed",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(require("path").join(__dirname, "../public/seed"), {
    maxAge: "7d",
    fallthrough: false,
  })
);

// Locally stored uploads (used when IMGBB_API_KEY is not set).
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  },
  express.static(require("./services/imageUpload.service").UPLOAD_DIR, {
    maxAge: "30d",
    fallthrough: false,
    index: false,
    dotfiles: "deny",
  })
);

// CORS — allowlist from CORS_ORIGINS env. Wildcard with credentials is
// invalid per spec; if no origins configured, fall back to permissive
// in non-production only.
const corsOrigins = config.corsOrigins;
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (corsOrigins.length === 0) {
        return cb(null, config.env !== "production");
      }
      if (corsOrigins.includes(origin)) return cb(null, true);
      // 403, not 500: a disallowed origin is the caller's problem.
      return cb(new ApiError(httpStatus.FORBIDDEN, `CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// parse json request body — preserve raw body for Stripe webhook signature
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Bad JSON:", err.message);
    return res.status(400).send({ message: "Invalid JSON" });
  }
  // Pass other errors on (e.g. a refused CORS origin). Calling next()
  // without the error used to run the route with no parsed body (500).
  next(err);
});

// NOTE: previously `app.use(express.static("public"))` served local
// uploads at /uploads/*. All image uploads now go to ImgBB and are
// referenced by absolute URL, so the static serve is removed. Legacy
// /uploads/* paths in old DB rows will 404 — run a migration if needed.

// sanitize request data (drops keys with $ / .) — replaces deprecated xss-clean
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// Middleware to attach IP address to request object
const attachIpAddress = (req, res, next) => {
  req.ipAddress =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  next();
};
app.use(attachIpAddress);

// jwt authentication
app.use(passport.initialize());
passport.use("jwt", jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === "production") {
  app.use("/v1/auth", authLimiter);
}

// Express Monitor
app.use(status());

// Maintenance mode gate (503 for non-admins while on).
app.use(require("./middlewares/maintenance"));

// v1 api routes
app.use("/v1", routes);

app.get("/", (req, res) => {
  res.status(200).send("<h1>Qwlee API</h1>");
});

//testing API is alive
app.get("/health", (req, res) => {
  let userIP =
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress;
  res.send({
    message: "Qwlee API health check",
    userIP,
    // Lets the test-suite confirm it is talking to a throw-away instance.
    ...(process.env.TEST_MODE === "true" ? { testMode: true } : {}),
  });
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "This API Not found"));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
