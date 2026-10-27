const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const response = require("../config/response");
const supportService = require("../services/support.service");

const isAdmin = (req) => req?.user?.role === "admin";

const createTicket = catchAsync(async (req, res) => {
  const ticket = await supportService.createTicket({
    userId: req.user.id,
    subject: req.body?.subject,
    category: req.body?.category,
    body: req.body?.body,
  });
  res.status(httpStatus.CREATED).json(
    response({
      message: "Ticket created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: { ticket },
    })
  );
});

const listMyTickets = catchAsync(async (req, res) => {
  const data = await supportService.listTickets({
    viewerId: req.user.id,
    viewer: isAdmin(req) ? "admin" : "user",
    status: req.query.status,
    aiEscalated: req.query.aiEscalated,
    limit: Number(req.query.limit) || 50,
    page: Number(req.query.page) || 1,
  });
  res.status(httpStatus.OK).json(
    response({
      message: "Tickets",
      status: "OK",
      statusCode: httpStatus.OK,
      data,
    })
  );
});

const getTicket = catchAsync(async (req, res) => {
  try {
    const data = await supportService.getTicket({
      ticketId: req.params.ticketId,
      viewerId: req.user.id,
      viewer: isAdmin(req) ? "admin" : "user",
    });
    res.status(httpStatus.OK).json(
      response({
        message: "Ticket",
        status: "OK",
        statusCode: httpStatus.OK,
        data,
      })
    );
  } catch (err) {
    const status = err.message === "Forbidden"
      ? httpStatus.FORBIDDEN
      : httpStatus.NOT_FOUND;
    throw new ApiError(status, err.message);
  }
});

const postMessage = catchAsync(async (req, res) => {
  try {
    const msg = await supportService.postMessage({
      ticketId: req.params.ticketId,
      senderId: req.user.id,
      senderRole: isAdmin(req) ? "admin" : "user",
      body: req.body?.body,
    });
    res.status(httpStatus.CREATED).json(
      response({
        message: "Message posted",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: { message: msg },
      })
    );
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

const updateStatus = catchAsync(async (req, res) => {
  try {
    const ticket = await supportService.updateStatus({
      ticketId: req.params.ticketId,
      status: req.body?.status,
      viewerRole: req.user.role,
    });
    res.status(httpStatus.OK).json(
      response({
        message: "Status updated",
        status: "OK",
        statusCode: httpStatus.OK,
        data: { ticket },
      })
    );
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

// Admin opens a ticket on behalf of users (Fiverr-style mediation).
// Accepts either { orderId } (auto-resolves buyer + seller) or an
// explicit { participantIds: [] } array. Always admin-only.
const adminCreateTicket = catchAsync(async (req, res) => {
  if (!isAdmin(req)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Admin only");
  }
  try {
    const ticket = await supportService.adminCreateTicket({
      adminId: req.user.id,
      orderId: req.body?.orderId,
      participantIds: req.body?.participantIds,
      subject: req.body?.subject,
      body: req.body?.body,
      category: req.body?.category,
      reason: req.body?.reason,
    });
    res.status(httpStatus.CREATED).json(
      response({
        message: "Ticket created",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: { ticket },
      })
    );
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

module.exports = {
  createTicket,
  adminCreateTicket,
  listMyTickets,
  getTicket,
  postMessage,
  updateStatus,
};
