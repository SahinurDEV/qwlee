const express = require("express");
const auth = require("../../middlewares/auth");
const messageController = require("../../controllers/message.controller");
const messageFileUploadMiddleware = require("../../middlewares/messageFileUpload");
const imgbbUpload = require("../../middlewares/imgbbUpload");

const upload = messageFileUploadMiddleware();
const router = express.Router();

router
  .route("/add-message")
  .post(
    auth("withOutAdmin"),
    upload.array("files"),
    imgbbUpload(),
    messageController.addMessage
  );
router.get("/search", auth("withOutAdmin"), messageController.searchMessages);

router
  .route("/get-messages")
  .get(auth("withOutAdmin"), messageController.getMessages);
// Mark a thread read (live "Seen" for the sender).
router.post("/read", auth("withOutAdmin"), require("../../utils/catchAsync")(async (req, res) => {
  const chatId = String(req.body?.chatId || "");
  await require("../../utils/access").assertChatMember(chatId, req.user.id);
  const n = await require("../../services/message.service").markRead(chatId, req.user._id);
  res.json({ code: 200, message: "Read", data: { attributes: { marked: n } } });
}));
router
  .route("/:messageId")
  .get(auth("withOutAdmin"), messageController.getMessage)
  .patch(auth("withOutAdmin"), messageController.updateMessageStatus)
  .put(auth("withOutAdmin"), messageController.cancelAndWithdrawOfferMessage)
  .delete(auth("withOutAdmin"), messageController.deleteMessage);

module.exports = router;
