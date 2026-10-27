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

const { deriveUniqueUsername } = require("../utils/deriveUsername");

const siteSettings = require("../services/siteSettings.service");
// Bump when the Terms change materially; stored with each consent.
const TERMS_VERSION = "2026-10";

const register = catchAsync(async (req, res) => {
const authCookies = require("../utils/authCookies");
  await siteSettings.assertFeature("signups", "Sign-up");
  // Consent record (validation already requires acceptTerms === true).
  delete req.body.acceptTerms;
  req.body.termsAcceptedAt = new Date();
  req.body.termsVersion = TERMS_VERSION;
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
    await userService.isUpdateUser(isUser.id, req.body);
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
    await userService.isUpdateUser(isUser.id, req.body);

    res.status(httpStatus.CREATED).json(
      response({
        message: "Thank you for registering. Please verify your email",
        status: "OK",
        statusCode: httpStatus.CREATED,
        data: {},
      })
    );
  } else {
    const refCode = req.body.ref;
    delete req.body.ref;
    const user = await userService.createUser(req.body);
    const referral = require("../services/referral.service");
    if (refCode) await referral.attach(user, refCode);
    await referral.grantWelcome(user);
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

// Issue tokens, record the sign-in and send the standard login payload.
async function sendLoginSuccess(req, res, user) {
  // Every sign-in path (password, Google, OTP) funnels through here, so an
  // account with 2FA can only get tokens after the code was checked.
  if (user.twoFactorEnabled && !req.twoFactorVerified) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "This account uses two-factor. Sign in with email, password and code.");
  }
  const tokens = await tokenService.generateAuthTokens(user, { req });

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
  authCookies.setAuthCookies(req, res, tokens);
  res.status(httpStatus.OK).json(
    response({
      status: "OK",
      statusCode: httpStatus.OK,
      message: "Login Successful",
      data: { user, tokens },
    })
  );
}

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  // Verify the password first and fail with one generic message, so the
  // endpoint can't be used to discover which emails are registered.
  // Account-state errors are only revealed to someone who knows the password.
  const isUser = await authService.loginUserWithEmailAndPassword(email, password);
  if (isUser.isDeleted === true) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }
  if (isUser.isEmailVerified === false) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email not verified");
  }
  if (isUser.isBan === true) await require("../services/moderation.service").liftIfExpired(isUser);
  if (isUser.isBan === true) {
    const reason =
      (isUser.banReason ||
      "Your account has been suspended by an administrator.") +
      (isUser.bannedUntil ? `\n\nSuspended until ${new Date(isUser.bannedUntil).toUTCString()}.` : "");
    // A short-lived appeal token lets them appeal without signing in.
    const appealToken = require("../services/moderation.service").appealToken(isUser._id);
    return res.status(httpStatus.FORBIDDEN).json({ code: 403, message: `BANNED:${reason}`, data: { attributes: { appealToken } } });
  }
  const user = isUser;

  // Two-factor (any role): password alone is not enough.
  if (user.twoFactorEnabled) {
    const otp = req.body.otp || req.body.code;
    if (!otp) {
      res.locals.twoFactorPrompt = true;
      return res.status(httpStatus.UNAUTHORIZED).json({ code: 401, message: "Enter the code from your authenticator app", data: { attributes: { twoFactorRequired: true } } });
    }
    const full = await require("../models").User.findById(user._id).select("+twoFactorSecret");
    if (!(await require("../services/twoFactor.service").check(full, otp))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid two-factor code");
    }
    req.twoFactorVerified = true;
  }

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
  await sendLoginSuccess(req, res, user);
});

const googleAuth = require("../services/googleAuth.service");

const googleConfig = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).json(
    response({ message: "Google sign-in", status: "OK", statusCode: httpStatus.OK, data: { enabled: googleAuth.isEnabled() && (await siteSettings.feature("googleLogin")) } })
  );
});

const googleStart = catchAsync(async (req, res) => {
  await siteSettings.assertFeature("googleLogin", "Google sign-in");
  const { url, nonce } = googleAuth.startAuth({ from: req.query.from, ref: req.query.ref });
  res.cookie(googleAuth.STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
  res.redirect(302, url);
});

const googleCallback = catchAsync(async (req, res) => {
  const target = await googleAuth.handleCallback(req);
  res.clearCookie(googleAuth.STATE_COOKIE, { path: "/" });
  res.redirect(302, target);
});

const googleExchange = catchAsync(async (req, res) => {
  const user = await googleAuth.exchangeLoginCode(req.body?.code);
  if (user.twoFactorEnabled) {
    // The Google code is single-use; hand back a short-lived challenge that
    // POST /auth/2fa/verify swaps for tokens together with the TOTP code.
    const challenge = require("../services/twoFactor.service").challengeFor(user);
    res.locals.twoFactorPrompt = true;
    return res.status(httpStatus.UNAUTHORIZED).json({ code: 401, message: "Enter the code from your authenticator app", data: { attributes: { twoFactorRequired: true, challenge } } });
  }
  await sendLoginSuccess(req, res, user);
});

const twoFactorVerify = catchAsync(async (req, res) => {
  const tf = require("../services/twoFactor.service");
  const user = await tf.userFromChallenge(req.body?.challenge);
  const full = await require("../models").User.findById(user._id).select("+twoFactorSecret");
  if (!(await tf.check(full, req.body?.code))) throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid two-factor code");
  req.twoFactorVerified = true;
  await sendLoginSuccess(req, res, user);
});

const logout = catchAsync(async (req, res) => {
  const refresh = req.body?.refreshToken || authCookies.readRefreshToken(req);
  const user = await authService.logout(refresh);
  authCookies.clearAuthCookies(req, res);
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
  const bodyToken = req.body?.refreshToken;
  const cookieToken = authCookies.readRefreshToken(req);
  const tokens = await authService.refreshAuth(bodyToken || cookieToken);
  authCookies.setAuthCookies(req, res, tokens);
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
  // An emailed code must not bypass two-factor.
  const tokens = user.twoFactorEnabled ? null : await tokenService.generateAuthTokens(user, { req });

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
  googleConfig,
  googleStart,
  googleCallback,
  googleExchange,
  twoFactorVerify,
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
