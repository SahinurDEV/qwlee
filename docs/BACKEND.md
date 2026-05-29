# Backend guide (`backend/`)

Express 4 + Mongoose 8 + Socket.IO. Runs on port 7171 (REST) and 8181 (socket) from the same Node process.

## Folder map

```
backend/src/
├── app.js                  Express app assembly
├── index.js                Mongo connect + http.listen + socket init
├── config/
│   ├── config.js           dotenv + Joi-validated env
│   ├── logger.js           winston logger (use this, not console.log)
│   ├── morgan.js           HTTP access log middleware
│   ├── passport.js         passport-jwt strategy
│   ├── response.js         { code, message, data: { attributes } } wrapper
│   └── roles.js            role → rights map
├── controllers/            thin: validate body, call service, return response()
├── services/               business logic + all Mongoose calls
├── models/                 Mongoose schemas; aggregated in models/index.js
├── routes/v1/              one router per area; mounted in routes/v1/index.js
├── middlewares/
│   ├── auth.js             passport + role check (auth("admin") etc.)
│   ├── error.js            converts ApiError + unknown errors → response
│   └── upload.js           multer config
├── socket/socketServer.js  Socket.IO server + handshake
├── validations/            Joi schemas (some routes still validate inline)
├── docs/                   swagger-jsdoc definitions
├── utils/
│   ├── ApiError.js         throw new ApiError(httpStatus.X, "msg")
│   ├── catchAsync.js       wrap async controller, forwards to error middleware
│   ├── pick.js             pluck specific keys from an object
│   └── seeder.js           legacy seeder (use seeders/index.js instead)
└── seeders/                npm run seed entrypoint
```

## How to add a new endpoint (the recipe)

A worked example: PRD §5.10 disputes. The same 6 steps apply to any new resource.

### 1. Model — `src/models/dispute.model.js`

```js
const mongoose = require("mongoose");
const { paginate } = require("./plugins");

const disputeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reasonCode: { type: String, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open","awaiting_response","escalated","resolved","cancelled"], default: "open", index: true },
    // ...
  },
  { timestamps: true }
);

disputeSchema.plugin(paginate);
module.exports = mongoose.model("Dispute", disputeSchema);
```

### 2. Export it — `src/models/index.js`

```js
module.exports.Dispute = require('./dispute.model');
```

### 3. Service — `src/services/dispute.service.js`

```js
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Dispute, Payment } = require("../models");
const { addCustomNotification } = require("./notification.service");

const openDispute = async (userId, body) => {
  const order = await Payment.findById(body.orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (order.status === "disputed") {
    throw new ApiError(httpStatus.BAD_REQUEST, "A dispute is already open on this order");
  }
  // ... write the dispute, mutate the order, notify counterparty
};

module.exports = { openDispute /* , ... */ };
```

Export in `src/services/index.js`:

```js
module.exports.disputeService = require('./dispute.service');
```

### 4. Controller — `src/controllers/dispute.controller.js`

Stay thin. `catchAsync` so errors propagate to the error middleware. `response()` wraps the envelope.

```js
const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { disputeService } = require("../services");

const openDispute = catchAsync(async (req, res) => {
  const dispute = await disputeService.openDispute(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(
    response({ message: "Dispute opened", status: "OK", statusCode: httpStatus.CREATED, data: dispute })
  );
});

module.exports = { openDispute /* , ... */ };
```

### 5. Routes — `src/routes/v1/dispute.routes.js`

```js
const express = require("express");
const auth = require("../../middlewares/auth");
const disputeController = require("../../controllers/dispute.controller");

const router = express.Router();

router.post("/", auth("common"), disputeController.openDispute);
router.get("/my", auth("common"), disputeController.getMyDisputes);
router.get("/", auth("admin"), disputeController.getDisputesAdmin);
router.post("/:disputeId/resolve", auth("admin"), disputeController.resolveDispute);

module.exports = router;
```

### 6. Mount it — `src/routes/v1/index.js`

```js
const disputeRoute = require('./dispute.routes');
// ...
defaultRoutes.push({ path: "/disputes", route: disputeRoute });
```

## Conventions

### Layers
- **Routes** know about HTTP + auth + the controller.
- **Controllers** know about `req`/`res` + the service. **No Mongoose** in controllers.
- **Services** own the business logic + persistence. They throw `ApiError`; they don't write to `res`.
- **Models** are pure schemas — keep computed/aggregation logic in services.

### Errors
- Always `throw new ApiError(httpStatus.X, "human-readable message")`.
- Never `throw new Error(...)` — the error middleware will still catch it but the response loses the right status code.

### Responses
- Build with `response({ message, status, statusCode, data })`. The payload lands at `data.attributes` on the client. Frontends strip the envelope with `transformResponse: (r) => r?.data?.attributes`.

### Auth
- `auth("admin")` — admin only
- `auth("freelancer")` — freelancer only
- `auth("buyer")` — buyer only
- `auth("common")` — any signed-in user (admin / freelancer / buyer)
- `auth("withOutAdmin")` — any non-admin signed-in user
- Multiple rights: `auth("admin", "common")` (any of)

### Notifications + sockets
- Use `addCustomNotification(eventName, userId, body)` from `services/notification.service.js`. It both persists a `Notification` row AND emits a socket event in one call.
- Conventions:
  - `addCustomNotification("buyer-notification", buyerId, body)`
  - `addCustomNotification("freelancer-notification", sellerId, body)`
  - `addCustomNotification("admin-notification", "admin", body)` (literal string `"admin"` — no per-user channel)
- `body` shape: `{ receiverId, role, type: "order"|"message"|"payment", linkId, message, ... }`

### Mongoose patterns
- Add `paginate` plugin to any model that will be listed: `schema.plugin(paginate)`. Use `Model.paginate(filter, options)` where `options` is `{ sortBy: "createdAt:desc", limit, page, populate }`.
- `toJSON` plugin (if added) strips `__v` and renames `_id` → `id`. Most models in this repo don't use it; consumers handle both.
- Don't add `.lean()` unless you've profiled a hot path.

### Logging
- `const logger = require("../config/logger");`
- `logger.info("...")`, `logger.warn(...)`, `logger.error(...)`. **No `console.log`** in committed code.

## Common pitfalls

- **Order status enum is mirrored in three places.** When you add a state, update:
  1. `models/payment.model.js` (canonical)
  2. `models/orders.model.js` (vestigial but still validated)
  3. `services/orders.service.js` `STATUS_KEYS`
- **Controllers/index.js isn't exhaustive.** Many controllers are required directly in routes — match the route file's existing style rather than the `controllers/index.js` aggregation style.
- **`Payment` vs `Orders`** — both exist, both have similar shape. `Payment` is canonical. New code targets `Payment`.
- **Cloudinary vs ImgBB** — the project moved off Cloudinary. Image uploads go through ImgBB (`IMGBB_API_KEY`). Local disk writes are not allowed.

## Running tests

There's no test suite yet. PRs are validated by:
1. Three-app boot succeeds
2. The seeder runs cleanly (`npm run seed`)
3. Affected endpoints respond with the right shape via `curl`
4. Affected UI works in the browser

Add tests when you build feature; we'll start collecting them.
