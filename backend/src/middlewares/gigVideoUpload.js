// Multer for native gig preview videos (mp4/webm). Memory storage →
// imageUpload.storeVideo writes to the local uploads volume.
const multer = require("multer");

const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime"]);

module.exports = function gigVideoUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const base = String(file.mimetype || "").split(";")[0].trim();
      if (ALLOWED.has(base) || base === "video/quicktime") {
        file.mimetype = base === "video/quicktime" ? "video/mp4" : base;
        return cb(null, true);
      }
      cb(new Error(`Only MP4 or WebM video is supported (received ${file.mimetype})`));
    },
  });
};
