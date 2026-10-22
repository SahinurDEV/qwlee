const { generateOtp } = require("../utils/otp");
const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { Token } = require("../models");
const {
  authService,
  tokenService,
  userService,
  emailService,
} = require("../services");
const ApiError = require("../utils/ApiError");
const {
  validateUsernameFormat,
  ERRORS: USERNAME_ERRORS,
} = require("../validations/username.validation");
const { isReserved } = require("../utils/reservedUsernames");

// Derive a unique username from a seed (the email local part) by suffixing
// a counter until we find a free slot. Used when the client hasn't picked
// a username themselves.
async function deriveUniqueUsername(seed) {
  const cleaned = (
    String(seed)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "")
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
      .slice(0, 18) || "user"
  );
  let candidate = cleaned;
  let i = 0;
  while (
    isReserved(candidate) ||
    (await userService.isUsernameTaken(candidate))
  ) {
    i += 1;
    candidate = `${cleaned}${i}`;
    if (i > 200) break;
  }
  return candidate;
}

const register = catchAsync(async (req, res) => {
  // Pick the final username. Client-provided wins (after format + reserved
  // + uniqueness checks); otherwise we derive a unique one from the email.
  if (req.body.username) {
    const check = validateUsernameFormat(req.body.username);
    if (!check.ok) throw new ApiError(httpStatus.BAD_REQUEST, check.message);
    if (isReserved(check.username))
      throw new ApiError(httpStatus.BAD_REQUEST, USERNAME_ERRORS.RESERVED);
    if (await userService.isUsernameTaken(check.username))
      throw new ApiError(httpStatus.BAD_REQUEST, USERNAME_ERRORS.TAKEN);
    req.body.username = check.username;
  } else {
    const seed = req.body.email.split("@")[0];
    req.body.username = await deriveUniqueUsername(seed);
  }

  const isUser = await userService.getUserByEmail(req.body.email);

  if (isUser && isUser.isEmailVerified === false) {
    const user = await userService.isUpdateUser(isUser.id, req.body);
    const tokens = await tokenService.generateAuthTokens(user);
    res.status(httpStatus.CREATED).json(
      response({
        message: "Thank you for registering. Please verify your email",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: {},
      })
    );
  } else if (isUser && isUser.isDeleted === false) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  } else if (isUser && isUser.isDeleted === true) {
    const user = await userService.isUpdateUser(isUser.id, req.body);
    const tokens = await tokenService.generateAuthTokens(user);

    res.status(httpStatus.CREATED).json(
      response({
        message: "Thank you for registering. Please verify your email",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: {},
      })
    );
  } else {
    const user = await userService.createUser(req.body);
    res.status(httpStatus.CREATED).json(
      response({
        message: "Thank you for registering. Please verify your email",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: {},
      })
    );
  }
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const isUser = await userService.getUserByEmail(email);
  // here we check if the user is in the database or not
  if (isUser?.isDeleted === true) {
    throw new ApiError(httpStatus.BAD_REQUEST, "This Account is Deleted");
  }
  if (isUser?.isEmailVerified === false) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email not verified");
  }
  if (!isUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "No users found with this email");
  }
  // Banned users get a special 403 with the admin-supplied reason so
  // the marketplace login screen can surface it inline. Check before
  // we validate the password — no point burning an attempt either way.
  if (isUser?.isBan === true) {
    const reason =
      isUser.banReason ||
      "Your account has been suspended by an administrator.";
    throw new ApiError(httpStatus.FORBIDDEN, `BANNED:${reason}`);
  }
  const user = await authService.loginUserWithEmailAndPassword(email, password);

  setTimeout(async () => {
    try {
      user.oneTimeCode = null;
      user.isResetPassword = false;
      await user.save();
    } catch (error) {
      ApiError;
      console.error("Error updating oneTimeCode:", error);
    }
  }, 180000);
  const tokens = await tokenService.generateAuthTokens(user);

  // Record the sign-in for the admin "monitor user" feature. Best-effort
  // — never block the login response if the activity write fails.
  try {
    const activityService = require("../services/activity.service");
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      "";
    await activityService.recordLogin({
      userId: user.id,
      ip,
      userAgent: req.headers["user-agent"] || "",
    });
  } catch (err) {
    console.error("activity.recordLogin failed:", err?.message);
  }
  res.status(httpStatus.OK).json(
    response({
      status: "OK",
      statusCode: httpStatus.OK,
      message: "Login Successful",
      data: { user, tokens },
    })
  );
});

const logout = catchAsync(async (req, res) => {
  const user = await authService.logout(req.body.refreshToken);
  res.status(httpStatus.OK).json(
    response({
      message: "Login Out Successful",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
});

const forgotPassword = catchAsync(async (req, res) => {
  const user = await userService.getUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No users found with this email"
    );
  }
  // if(user.oneTimeCode === 'verified'){
  //   throw new ApiError(
  //     httpStatus.BAD_REQUEST,
  //     "try 3 minute later"
  //   );
  // }
  // Generate OTC (One-Time Code)
  const oneTimeCode =
    generateOtp();

  // Store the OTC and its expiration time in the database
  user.oneTimeCode = oneTimeCode;
  user.isResetPassword = true;
  await user.save();

  //console.log("oneTimeCode", user);
  const sent = await emailService.sendResetPasswordEmail(req.body.email, oneTimeCode);
  if (!sent) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "We could not send the reset email right now. Please try again later."
    );
  }
  res.status(httpStatus.OK).json(
    response({
      message: "Email Sent",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(
    req.body.password,
    req.body.email,
    req.body.oneTimeCode
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Password Reset Successful",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user, req.body);
  res.status(httpStatus.OK).json(
    response({
      message: "Password Change Successful",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const sendVerificationEmail = catchAsync(async (req, res,next) => {
  // const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  // await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  // res.status(httpStatus.OK).send();
});

const verifyEmail = catchAsync(async (req, res,next) => {
  const user = await authService.verifyEmail(req.body, req.query);
  const tokens = await tokenService.generateAuthTokens(user);

  res.status(httpStatus.OK).json(
    response({
      message: "Email Verified",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user, tokens },
    })
  );
  // res.status(httpStatus.OK).send();
});

const deleteMe = catchAsync(async (req, res,next) => {
  const user = await authService.deleteMe(req.body.password, req.user);
  res.status(httpStatus.OK).json(
    response({
      message: "Account Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user },
    })
  );
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  verifyEmail,
  deleteMe,
  changePassword,
};
