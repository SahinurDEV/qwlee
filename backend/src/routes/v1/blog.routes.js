const express = require("express");
const auth = require("../../middlewares/auth");
const blogController = require("../../controllers/blog.controller");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const convertHeicToPng = require("../../middlewares/converter");
const imgbbUpload = require("../../middlewares/imgbbUpload");

const upload = userFileUploadMiddleware();
const router = express.Router();

router
  .route("/")
  .get(blogController.getBlogs)
  .post(
    auth("admin"),
    upload.single("image"),
    convertHeicToPng(),
    imgbbUpload({ optional: false }),
    blogController.createBlog
  );


router.post("/suggest", auth("admin"), (req, res) => {
  const blogAi = require("../../services/blogAi.service");
  res.status(200).json({ code: 200, message: "OK", data: blogAi.suggest(req.body || {}) });
});

router
  .route("/:blogId")
  .get(blogController.getBlog)
  .delete(auth("admin"), blogController.deleteBlog)
  .patch(
    auth("admin"),
    upload.single("image"),
    convertHeicToPng(),
    imgbbUpload(),
    blogController.updateBlog
  );

router.route("/slug/:slug").get(blogController.slugBlog);

module.exports = router;
