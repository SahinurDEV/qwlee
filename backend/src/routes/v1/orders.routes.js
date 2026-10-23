const express = require("express");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const ordersController = require("../../controllers/orders.controller");

const router = express.Router();

// Stripe webhook — rawBody is captured by the global express.json verify
// hook (see app.js), so a route-level raw parser is unnecessary.
router.route("/webhook").post(ordersController.orderPlaced);
router
  .route("/freelancer")
  .get(auth("freelancer"), ordersController.freelancerOrdersList);

router
  .route("/checkout")
  .post(auth("withOutAdmin"), ordersController.orderCreate)
  //   .patch(auth("admin"), categoriesController.updateCategory)
  .get(auth("withOutAdmin"), ordersController.getOrders);
router
  .route("/totalIncome")
  .get(auth("withOutAdmin"), ordersController.myTotalIncome);
router
  .route("/counts")
  .get(auth("withOutAdmin"), ordersController.getOrderCounts);
router
  .route("/")
  .patch(auth("withOutAdmin"), ordersController.orderModify)
  .get(auth("withOutAdmin"), ordersController.getMyOrders);
// Delivery-date extension flow. Seller POSTs to request, buyer PATCHes
// to accept/decline. Auth is wide ("common") on PATCH because the buyer
// may be in either role mode when responding.
router
  .route("/:orderId/extension")
  .post(auth("freelancer"), ordersController.requestExtension)
  .patch(auth("common"), ordersController.respondExtension);

// Mutual cancellation: POST asks, PATCH {action: accept|decline|withdraw}.
{
  const cancellation = require("../../services/cancellation.service");
  const catchAsync = require("../../utils/catchAsync");
  const send = (res, data, message) => res.json({ code: 200, message, data: { attributes: data } });
  router.post("/:orderId/cancellation", auth("withOutAdmin"), catchAsync(async (req, res) =>
    send(res, await cancellation.request(req.params.orderId, req.user.id, req.body?.reason), "Cancellation requested")));
  router.patch("/:orderId/cancellation", auth("withOutAdmin"), catchAsync(async (req, res) =>
    send(res, await cancellation.respond(req.params.orderId, req.user.id, req.body?.action), "Cancellation updated")));
}
router.post("/quote", auth("withOutAdmin"), ordersController.orderQuote);
router.post("/:orderId/requirements", auth("withOutAdmin"), ordersController.submitRequirements);
router.post("/:orderId/revision", auth("withOutAdmin"), ordersController.requestRevision);
router.post("/:orderId/accept", auth("withOutAdmin"), ordersController.acceptDelivery);
// Milestone payments: the buyer releases one milestone's share of escrow.
router.post("/:orderId/milestones/:index/release", auth("withOutAdmin"), require("../../utils/catchAsync")(async (req, res) => {
  const order = await require("../../services/milestones.service").release(req.params.orderId, req.user.id, req.params.index);
  res.json({ code: 200, message: "Milestone released", data: { attributes: { milestones: order.data?.milestones || [], status: order.status } } });
}));
router.post("/:orderId/tip", auth("withOutAdmin"), ordersController.orderTip);

router
  .route("/:orderId")
  .get(auth("withOutAdmin"), ordersController.getOrderById);

// Calls and scheduling inside an order (orderCall.service).
const callsSvc = require("../../services/orderCall.service");
const cA = require("../../utils/catchAsync");
const sendC = (code, fn) => cA(async (req, res) => res.status(code).json({ code, message: "OK", data: { attributes: await fn(req) } }));
router.get("/:orderId/calls", auth("withOutAdmin"), sendC(200, (req) => callsSvc.list(req.params.orderId, req.user)));
router.post("/:orderId/calls", auth("withOutAdmin"), sendC(201, (req) => callsSvc.propose(req.params.orderId, req.user, req.body)));
router.post("/:orderId/calls/:callId/accept", auth("withOutAdmin"), sendC(200, (req) => callsSvc.accept(req.params.orderId, req.params.callId, req.user, req.body?.slot)));
router.post("/:orderId/calls/:callId/decline", auth("withOutAdmin"), sendC(200, (req) => callsSvc.setStatus(req.params.orderId, req.params.callId, req.user, "declined")));
router.post("/:orderId/calls/:callId/cancel", auth("withOutAdmin"), sendC(200, (req) => callsSvc.setStatus(req.params.orderId, req.params.callId, req.user, "cancelled")));

module.exports = router;
