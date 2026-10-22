const mongoose = require('mongoose');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    // Bad ids / invalid documents are the client's fault: 400 with a
    // clear message instead of a generic 500.
    if (error instanceof mongoose.Error.CastError) {
      error = new ApiError(httpStatus.BAD_REQUEST, `Invalid ${error.path === '_id' ? 'id' : error.path}`, true, err.stack);
    } else if (error instanceof mongoose.Error.ValidationError) {
      const first = Object.values(error.errors || {})[0];
      error = new ApiError(httpStatus.BAD_REQUEST, first?.message || 'Invalid data', true, err.stack);
    } else if (error.type === 'entity.parse.failed') {
      error = new ApiError(httpStatus.BAD_REQUEST, 'Malformed JSON body', true, err.stack);
    } else {
      const statusCode = error.statusCode || error.status || httpStatus.INTERNAL_SERVER_ERROR;
      const message = error.message || httpStatus[statusCode];
      error = new ApiError(statusCode, message, statusCode < 500, err.stack);
    }
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
