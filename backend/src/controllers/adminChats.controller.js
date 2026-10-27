const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const response = require("../config/response");
const adminChatsService = require("../services/adminChats.service");

const listDirectChats = catchAsync(async (req, res) => {
  const data = await adminChatsService.listDirectChats({
    search: req.query.search,
    limit: Number(req.query.limit) || 100,
    page: Number(req.query.page) || 1,
  });
  res.status(httpStatus.OK).json(response({ message: "Chats", status: "OK", statusCode: httpStatus.OK, data }));
});

const getDirectChat = catchAsync(async (req, res) => {
  try {
    const data = await adminChatsService.getDirectChat(req.params.chatId);
    res.status(httpStatus.OK).json(response({ message: "Chat", status: "OK", statusCode: httpStatus.OK, data }));
  } catch (err) {
    throw new ApiError(httpStatus.NOT_FOUND, err.message);
  }
});

const listOrderChats = catchAsync(async (req, res) => {
  const data = await adminChatsService.listOrderChats({
    search: req.query.search,
    limit: Number(req.query.limit) || 100,
    page: Number(req.query.page) || 1,
  });
  res.status(httpStatus.OK).json(response({ message: "Order chats", status: "OK", statusCode: httpStatus.OK, data }));
});

const getOrderChat = catchAsync(async (req, res) => {
  try {
    const data = await adminChatsService.getOrderChat(req.params.orderId);
    res.status(httpStatus.OK).json(response({ message: "Order chat", status: "OK", statusCode: httpStatus.OK, data }));
  } catch (err) {
    throw new ApiError(httpStatus.NOT_FOUND, err.message);
  }
});

const listFlagged = catchAsync(async (req, res) => {
  const data = await adminChatsService.listFlaggedMessages({
    status: req.query.status || "open",
    limit: Number(req.query.limit) || 50,
    page: Number(req.query.page) || 1,
  });
  res.status(httpStatus.OK).json(response({ message: "Flagged messages", status: "OK", statusCode: httpStatus.OK, data }));
});

module.exports = { listDirectChats, getDirectChat, listOrderChats, getOrderChat, listFlagged };
