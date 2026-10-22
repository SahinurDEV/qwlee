// Verification routes — seller submits NID / passport, admin reviews.
//
// Submit accepts three named files (front / back / selfie) so we use
// multer's `.fields(...)` shape. The generic imgbbUpload middleware
// only handles req.file / req.files-as-array, so we run uploadMany
// manually here per field key.

const express = require("express");
const auth = require("../../middlewares/auth");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const verificationController = require("../../controllers/verification.controller");

const router = express.Router();
const upload = userFileUploadMiddleware();

const FIELDS = upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]);

// ID documents are private: stored on the server (never ImgBB) and only
// shown to admins through short-lived signed links.
async function pushToImgbb(req, _res, next) {
  try {
    const pf = require("../../services/privateFiles.service");
    const files = req.files || {};
    const tasks = [];
    for (const key of Object.keys(files)) {
      for (const file of files[key]) {
        tasks.push(
          pf.store(file).then((ref) => {
            Object.assign(file, { cloudUrl: ref, buffer: undefined });
          })
        );
      }
    }
    await Promise.all(tasks);
    next();
  } catch (err) {
    next(err);
  }
}

router.post(
  "/submit",
  auth("common"),
  FIELDS,
  pushToImgbb,
  verificationController.submit
);

// Admin review endpoints.
router.get("/", auth("admin"), verificationController.list);
router.patch("/:userId", auth("admin"), verificationController.review);

module.exports = router;
