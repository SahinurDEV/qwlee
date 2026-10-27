// Support ticketing routes — shared between the marketplace user UI
// and the admin dashboard. The controller decides on `viewer` scope
// based on req.user.role, so we don't need separate user/admin route
// trees.

const express = require("express");
const auth = require("../../middlewares/auth");
const supportController = require("../../controllers/support.controller");
const supportAiController = require("../../controllers/supportAi.controller");

const router = express.Router();

router.use(auth("common"));

router.get("/ai/status", supportAiController.status);
router.post("/ai/ask", supportAiController.ask);

router
  .route("/tickets")
  .post(supportController.createTicket)
  .get(supportController.listMyTickets);
router
  .route("/tickets/:ticketId")
  .get(supportController.getTicket)
  .patch(supportController.updateStatus);
router.post("/tickets/:ticketId/messages", supportController.postMessage);

module.exports = router;
