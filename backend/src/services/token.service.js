const jwt = require('jsonwebtoken');
const moment = require('moment');
const httpStatus = require('http-status');
const config = require('../config/config');
const userService = require('./user.service');
const { Token } = require('../models');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');


const generateToken = (userId, expires, type, secret = config.jwt.secret, sid) => {
  const payload = {
    sub: userId,
    ...(sid ? { sid } : {}),
    iat: moment().unix(),
    exp: moment().add(expires, 'seconds').unix(), // Assuming 'expires' is a duration in seconds
    type,
  };

  // console.log("payload", payload);
  return jwt.sign(payload, secret);
};



const saveToken = async (token, userId, expires, type, blacklisted = false, sid) => {
  const tokenDoc = await Token.create({
    token,
    ...(sid ? { sid } : {}),
    user: userId,
    expires: expires.toDate(),
    type,
    blacklisted,
  });
  return tokenDoc;
};


const verifyToken = async (token, type) => {
  const payload = jwt.verify(token, config.jwt.secret);
  const tokenDoc = await Token.findOne({ token, type, user: payload.sub, blacklisted: false });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};


// `opts.req` starts a new device session; `opts.sid` continues one (refresh).
const generateAuthTokens = async (user, opts = {}) => {
  const sessionService = require('./session.service');
  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const sid = opts.sid || (await sessionService.create(user.id || user._id, refreshTokenExpires.toDate(), opts.req));
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS, config.jwt.secret, sid);

  const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH, config.jwt.secret, sid);
  await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH, false, sid);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};


const generateResetPasswordToken = async (email) => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
  }
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, user.id, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

const generateVerifyEmailToken = async (user) => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.id, expires, tokenTypes.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.id, expires, tokenTypes.VERIFY_EMAIL);
  return verifyEmailToken;
};

module.exports = {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken,
};
