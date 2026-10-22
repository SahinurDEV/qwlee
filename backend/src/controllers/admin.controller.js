const catchAsync = require("../utils/catchAsync");
const adminService = require("../services/admin.service");
const response = require("../config/response");
const httpStatus = require("http-status");
const pick = require("../utils/pick");

const getTotalStatus = catchAsync(async (req, res, next) => {
  const result = await adminService.getTotalStatus();
  res.status(httpStatus.OK).json(
    response({
      message: "Total Status Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getIncomeRatio = catchAsync(async (req, res, next) => {
  const { year } = pick(req.query, ["year"]);
  if (!year) {
    return res.status(httpStatus.BAD_REQUEST).json(
      response({
        message: "Year query parameter is required",
        status: "BAD_REQUEST",
        statusCode: httpStatus.BAD_REQUEST,
        data: null,
      })
    );
  }
  const result = await adminService.getIncomeRatio(year);
  res.status(httpStatus.OK).json(
    response({
      message: "Income Ratio Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getUserRatio = catchAsync(async (req, res, next) => {
  const { month } = pick(req.query, ["month"]);
  const result = await adminService.getUserRatio(month);
  res.status(httpStatus.OK).json(
    response({
      message: "User Ratio Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const getRecentUsers = catchAsync(async (req, res, next) => {
  const filter = pick(req.query, ["fullName","role","username","email"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await adminService.getRecentUsers(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "Recent Users Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
})
const getAllEarning = catchAsync(async (req, res, next) => {
  const filter = pick(req.query, ["userName", "date"]);
  const options = pick(req.query, ["sortBy", "limit", "page", "populate"]);
  const result = await adminService.queryEarning(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "All Earning Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

// Admin: full platform orders list. Unlike /orders (scoped to the
// caller) this returns every order, populated with gig/buyer/seller.
const getAllOrders = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["status"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await adminService.queryAllOrders(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "All Orders Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

// Admin: full platform gig list. Surfaces every gig including ones the
// admin's own user would otherwise have excluded via the marketplace
// listing's exclude-own filter.
const getAllGigs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["title", "categories"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await adminService.queryAllGigs(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "All Gigs Retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});

const banUser = catchAsync(async (req, res) => {
  const { reason, days } = req.body || {};
  const result = await adminService.banUser(req.params.userId, { reason, days });
  res.status(httpStatus.OK).json(
    response({
      message: "User banned",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user: result },
    })
  );
});

const unbanUser = catchAsync(async (req, res) => {
  const result = await adminService.unbanUser(req.params.userId);
  res.status(httpStatus.OK).json(
    response({
      message: "User unbanned",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user: result },
    })
  );
});

const cancelOrder = catchAsync(async (req, res) => {
  const result = await adminService.cancelOrder(req.params.orderId, {
    reason: req.body?.reason,
    adminId: req.user?.id,
  });
  res.status(httpStatus.OK).json(
    response({
      message: "Order cancelled by admin",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { order: result },
    })
  );
});

module.exports = {
  getTotalStatus,
  getIncomeRatio,
  getUserRatio,
  getRecentUsers,
  getAllEarning,
  getAllOrders,
  getAllGigs,
  banUser,
  unbanUser,
  cancelOrder,
};
