const optionalAuth = require("../../middlewares/optionalAuth");
const express = require("express");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const userValidation = require("../../validations/user.validation");
const userController = require("../../controllers/user.controller");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const convertHeicToPng = require("../../middlewares/converter");
const imgbbUpload = require("../../middlewares/imgbbUpload");

const upload = userFileUploadMiddleware();

const router = express.Router();
router.route("/profile").post(auth("common"), userController.updateUser);
router
  .route("/profile-image")
  .post(
    auth("common"),
    upload.single("image"),
    convertHeicToPng(),
    imgbbUpload({ optional: false }),
    userController.updateProfileImage
  );

router
  .route("/cover-image")
  .post(
    auth("common"),
    upload.single("image"),
    convertHeicToPng(),
    imgbbUpload({ optional: false }),
    userController.updateCoverImage
  );
router.route("/public").get(userController.getUsersPublicById);

// Username system — placed above the generic /:userId so we don't try
// to cast usernames as ObjectIds. Both endpoints are public.
router.route("/check-username/:username").get(userController.checkUsername);
router.route("/by-username/:username").get(userController.getUserPublicByUsername);

// Self-service role upgrade — authenticated users can flip themselves
// from buyer to freelancer. Must live above /:userId to avoid clashing.
router.route("/become-seller").post(auth("common"), userController.becomeSeller);

// Personal data: download everything we store, or erase the account.
const privacy = require("../../services/privacy.service");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
router.get("/me/export", auth("common"), catchAsync(async (req, res) => {
  const data = await privacy.exportUser(req.user._id);
  res.set("Content-Disposition", `attachment; filename="qwlee-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.set("Cache-Control", "no-store");
  res.json(data);
}));
router.get("/me/delete-check", auth("common"), catchAsync(async (req, res) => {
  res.json({ code: 200, message: "OK", data: { attributes: { blockers: await privacy.blockers(req.user) } } });
}));
router.post("/me/delete", auth("common"), catchAsync(async (req, res) => {
  if (req.body?.confirm !== "DELETE") throw new ApiError(400, 'Type DELETE to confirm');
  const User = require("../../models/user.model");
  const u = await User.findById(req.user._id);
  const hasPassword = !!u?.password && !u.googleId;
  if (hasPassword && !(await u.isPasswordMatch(String(req.body?.password || "")))) throw new ApiError(400, "Incorrect password");
  res.json({ code: 200, message: "Account deleted", data: { attributes: await privacy.eraseUser(req.user._id, { by: "self" }) } });
}));

// Job Success Score (public): share of a seller's recent orders that ended well.
router.get("/:userId/job-success", catchAsync(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.userId)) throw new ApiError(400, "Invalid user id");
  const data = await require("../../services/jobSuccess.service").forSeller(req.params.userId);
  res.json({ code: 200, message: "Job Success", data: { attributes: data } });
}));

router.route("/").get(optionalAuth(), userController.getUsers);

router
  .route("/:userId")
  .get(optionalAuth(), validate(userValidation.getUser), userController.getUser);
router.route("/stats/:userId").get(auth("common"), userController.getUserStats);

module.exports = router;
