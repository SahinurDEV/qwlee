// Middleware: after multer has attached req.file / req.files (all in memory,
// thanks to fileUpload.js), push each buffer to ImgBB and replace the file
// object with a thin descriptor controllers can read:
//
//   file.cloudUrl      → primary CDN url (controllers should persist this)
//   file.thumbUrl      → small thumbnail url
//   file.deleteUrl     → ImgBB-issued delete URL (store if you want
//                         delete-from-cloud workflows)
//
// This keeps controllers a one-line change: replace
//     "/uploads/x/" + file.filename
// with
//     file.cloudUrl
//
// If no files were uploaded, the middleware is a no-op.

const imageUploadService = require("../services/imageUpload.service");

module.exports = function imgbbUpload({ optional = true } = {}) {
  return async (req, res, next) => {
    try {
      const hasFile = !!req.file;
      const hasFiles = Array.isArray(req.files) && req.files.length > 0;

      if (!hasFile && !hasFiles) {
        if (optional) return next();
        return next(new Error("No file uploaded"));
      }

      if (hasFile) {
        const result = await imageUploadService.uploadOne(req.file);
        Object.assign(req.file, {
          cloudUrl: result.url,
          displayUrl: result.displayUrl,
          thumbUrl: result.thumbUrl,
          deleteUrl: result.deleteUrl,
          // Buffer can be dropped now; downstream doesn't need it and
          // keeping it wastes memory on long requests.
          buffer: undefined,
        });
      }

      if (hasFiles) {
        // Voice notes (audio/*) are stored locally; images go to ImgBB
        // (or local disk when no key is set).
        const results = [];
        for (const f of req.files) {
          results.push(
            String(f.mimetype || "").startsWith("audio/")
              ? await imageUploadService.storeAudio(f)
              : await imageUploadService.uploadOne(f)
          );
        }
        results.forEach((r, i) => {
          Object.assign(req.files[i], {
            cloudUrl: r.url,
            displayUrl: r.displayUrl,
            thumbUrl: r.thumbUrl,
            deleteUrl: r.deleteUrl,
            buffer: undefined,
          });
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
