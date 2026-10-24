const express = require("express");
const auth = require("../../middlewares/auth");
const chatController = require("../../controllers/chat.controller");

const router = express.Router();

router.post("/add-chat", auth("withOutAdmin"), chatController.addChat);
router.get("/get-chat", auth("withOutAdmin"), chatController.getChats);
router.post("/:chatId/report", auth("withOutAdmin"), chatController.reportChat);
router.get("/:chatId/context", auth("withOutAdmin"), chatController.chatContext);
//check status in the body
router
  .route("/:chatId")
  .get(auth("withOutAdmin"), chatController.getChat)
  .patch(auth("withOutAdmin"), chatController.updateChat)
  .delete(auth("withOutAdmin"), chatController.deleteChat);

module.exports = router;
