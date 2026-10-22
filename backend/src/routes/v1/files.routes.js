const express = require("express");
const fs = require("fs");
const pf = require("../../services/privateFiles.service");

const router = express.Router();

// Signed, expiring links for private files (see privateFiles.service).
router.get("/private/:name", (req, res) => {
  const { name } = req.params;
  if (!pf.verify(name, req.query.exp, req.query.sig)) return res.status(403).json({ code: 403, message: "Link expired or invalid" });
  const p = pf.filePath(name);
  if (!fs.existsSync(p)) return res.status(404).json({ code: 404, message: "Not found" });
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.set("Referrer-Policy", "no-referrer");
  res.sendFile(p);
});

module.exports = router;
