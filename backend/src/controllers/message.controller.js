const { assertChatMember } = require("../utils/access");
const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { messageService, chatService } = require("../services");
const { io } = require("../socket/socketServer");

const getFileTypeFromMimetype = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("application/")) return "application";
  if (mimeType.startsWith("video/")) return "video";
  return "unknown"; // Default if the type is not recognized
};

const addMessage = catchAsync(async (req, res) => {
  const sender = req.user.id;
  const { message, receiver, offerDetails, gigReference } = req.body;

  let parsedOfferDetails = {};
  let parsedGigReference = null;

  try {
    if (offerDetails) {
      parsedOfferDetails = JSON.parse(offerDetails);
    }
  } catch (error) {
    // Handle parsing error
    console.error("Error parsing offerDetails:", error.message);
    parsedOfferDetails = {};
  }

  try {
    if (gigReference) {
      // Sent as a JSON string in FormData; allow plain objects too.
      parsedGigReference =
        typeof gigReference === "string"
          ? JSON.parse(gigReference)
          : gigReference;
    }
  } catch (error) {
    console.error("Error parsing gigReference:", error.message);
    parsedGigReference = null;
  }

  // Check for existing chat or create a new one
  let chatInfo = await chatService.getChatByParticipants([sender, receiver]);

  if (!chatInfo) {
    chatInfo = await chatService.addChat({ participants: [sender, receiver] });
    if (!chatInfo) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to create a new chat."
      );
    }
  }

  // Reset deletedBy field if the chat was deleted by users
  if (chatInfo.deletedBy.length > 0) {
    chatInfo.deletedBy = [];
    await chatInfo.save();
  }

  // Prepare message content
  const newMessage = {
    chat: chatInfo.id,
    content: {
      messageType: offerDetails
        ? "offer"
        : req.files?.length > 0
        ? getFileTypeFromMimetype(req.files[0].mimetype)
        : "text",
      message: message || "",

      files:
        req.files?.map((file) => ({
          path: file.cloudUrl,
          fileType: getFileTypeFromMimetype(file.mimetype),
        })) || [],
      offerDetails: parsedOfferDetails || {},
      gigReference: parsedGigReference || undefined,
    },
    sender,
    receiver,
  };

  // Send and save the message
  const messageSent = await messageService.addMessage(newMessage);

  if (messageSent) {
    // Build a chat snapshot from each side's perspective. `getChat(viewer, chatId)`
    // returns the participant list as { the OTHER party, you } — so the
    // sender and receiver need different copies for their sidebars.
    const senderChat = await chatService.getChat(sender, chatInfo.id);
    const receiverChat = await chatService.getChat(receiver, chatInfo.id);

    io.to(receiver).emit("new-chat", { chat: receiverChat, lastMessage: newMessage });
    io.to(receiver).emit("new-message", newMessage);

    // Mirror to the sender so their own sidebar reorders without waiting
    // for a manual refresh.
    io.to(sender).emit("new-chat", { chat: senderChat, lastMessage: newMessage });
    io.to(sender).emit("new-message-self", newMessage);

    res.status(httpStatus.CREATED).json(
      response({
        message: "Message added successfully",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: messageSent,
      })
    );
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "Something went wrong");
  }
});

const getMessages = catchAsync(async (req, res) => {
  const chatId = req.query.chatId;
  await assertChatMember(chatId, req.user.id);
  const options = pick(req.query, [
    "limit",
    "page",
    "sortBy",
    "startDate",
    "endDate",
  ]);

  // Validate required parameters
  if (!chatId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Chat ID is required.");
  }

  // Fetch messages
  const result = await messageService.getMessages(chatId, options, req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "Messages fetched successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});
const getMessage = catchAsync(async (req, res) => {
  const messageId = req.params.messageId;

  // Validate required parameters
  if (!messageId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Message ID is required.");
  }

  const message = await messageService.getMessage(messageId, req.user.id);

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, "Message not found.");
  }

  res.status(httpStatus.OK).json(
    response({
      message: "Message fetched successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: message,
    })
  );
});
const updateMessageStatus = catchAsync(async (req, res) => {
  const messageId = req.params.messageId;
  const { status } = req.body;

  // Validate required parameters
  if (!messageId || !status) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Message ID and status are required."
    );
  }

  const updatedMessage = await messageService.updateMessageStatus(
    messageId,
    status
  );

  if (!updatedMessage) {
    throw new ApiError(httpStatus.NOT_FOUND, "Message not found.");
  }

  res.status(httpStatus.OK).json(
    response({
      message: "Message status updated successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: updatedMessage,
    })
  );
});

const cancelAndWithdrawOfferMessage = catchAsync(async (req, res) => {
  const messageId = req.params.messageId;
  // Validate required parameters
  if (!messageId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Message ID is required.");
  }

  const updatedMessage = await messageService.cancelAndWithdrawOfferMessage(
    messageId,
    req.user.id
  );

  if (!updatedMessage) {
    throw new ApiError(httpStatus.NOT_FOUND, "Message not found.");
  }

  res.status(httpStatus.OK).json(
    response({
      message: "Message canceled and withdrawn successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: updatedMessage,
    })
  );
});
const deleteMessage = catchAsync(async (req, res) => {
  const messageId = req.params.messageId;

  // Validate required parameters
  if (!messageId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Message ID is required.");
  }

  const message = await messageService.deleteMessage(messageId, req.user.id);

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, "Message not found.");
  }

  res.status(httpStatus.OK).json(
    response({
      message: "Message deleted successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

module.exports = {
  addMessage,
  getMessage,
  getMessages,
  updateMessageStatus,
  deleteMessage,
  cancelAndWithdrawOfferMessage,
};
