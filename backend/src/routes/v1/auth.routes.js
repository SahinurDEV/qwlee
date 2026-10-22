const express = require('express');
const validate = require('../../middlewares/validate');
const authValidation = require('../../validations/auth.validation');
const authController = require('../../controllers/auth.controller');
const auth = require('../../middlewares/auth');
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER_USERS = "./public/uploads/users";
const router = express.Router();


router.get('/google/config', authController.googleConfig);
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);
router.post('/google/exchange', authController.googleExchange);
router.post('/2fa/verify', authController.twoFactorVerify);
router.post('/register', validate(authValidation.register), authController.register);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword);
router.post('/change-password', auth('common'),validate(authValidation.changePassword), authController.changePassword);
router.post('/forgot-password', validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/logout', validate(authValidation.logout), authController.logout);
router.post('/refresh-tokens', validate(authValidation.refreshTokens), authController.refreshTokens);
// router.post('/send-verification-email', auth(), authController.sendVerificationEmail);
router.post('/delete-me',auth('user'),validate(authValidation.deleteMe),authController.deleteMe);


// A banned user appeals with the token from their refused sign-in.
router.post("/appeal", require("../../utils/catchAsync")(async (req, res) => {
  const { appealToken, message } = req.body || {};
  const a = await require("../../services/moderation.service").createAppeal(appealToken, message);
  res.status(201).json({ code: 201, message: "Appeal sent. We'll email you when it has been reviewed.", data: { attributes: a } });
}));

module.exports = router;

