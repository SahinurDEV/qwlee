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

router.route("/").get(optionalAuth(), userController.getUsers);

router
  .route("/:userId")
  .get(optionalAuth(), validate(userValidation.getUser), userController.getUser);
router.route("/stats/:userId").get(auth("common"), userController.getUserStats);

module.exports = router;
