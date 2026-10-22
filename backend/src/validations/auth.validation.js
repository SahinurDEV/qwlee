const Joi = require("joi");
const { password } = require("./custom.validation");

const register = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    fullName: Joi.string().required(),
    // Role is optional — new accounts default to "buyer" and upgrade to
    // "freelancer" later via POST /v1/users/become-seller. "admin" is
    // disallowed at the public registration endpoint regardless.
    role: Joi.string().valid("freelancer", "buyer").default("buyer"),
    // Optional — when present it must pass the format check; if absent the
    // controller derives one from the email and ensures it's unique.
    username: Joi.string()
      .lowercase()
      .min(3)
      .max(24)
      .pattern(/^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])?$/)
      .optional(),
    // Optional — auto-detected on the client from the visitor's IP
    // (Fiverr-style) and forwarded here so the seller profile can be
    // pre-populated without bothering the user with a typed input.
    location: Joi.string().max(120).optional().allow(""),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required(),
    // Admin two-factor: 6-digit TOTP or a recovery code.
    otp: Joi.string().max(20).allow(""),
  }),
};

const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

const resetPassword = {
  // OTP from forgot-password is required — without it /reset-password
  // would trust the email blindly and any attacker who knows a victim's
  // email could rewrite their password.
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
    email: Joi.string().required(),
    oneTimeCode: Joi.alternatives()
      .try(Joi.string(), Joi.number())
      .required(),
  }),
};
const changePassword = {
  body: Joi.object().keys({
    oldPassword: Joi.string().required().custom(password),
    newPassword: Joi.string().required().custom(password),
  }),
};

const verifyEmail = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    oneTimeCode: Joi.string().required(),
  }),
};

const deleteMe = {
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
  }),
};

const sendOTP = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required(),
  }),
}
const verifyOTP = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required(),
    otpCode: Joi.string().required(),
  }),
}
module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  verifyEmail,
  deleteMe,
  changePassword
};
