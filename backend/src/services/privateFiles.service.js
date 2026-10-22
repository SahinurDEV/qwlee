// Private uploads (ID documents). They are never sent to ImgBB (public)
// and never served by the public /uploads route. Stored as
// "private:<file>" and only reachable through short-lived signed links
// that the admin API hands out.
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { UPLOAD_DIR } = require("./imageUpload.service");

const PRIVATE_DIR = process.env.PRIVATE_UPLOAD_DIR || path.join(UPLOAD_DIR, ".private");
const PREFIX = "private:";
const secret = () => `${process.env.JWT_SECRET || "dev"}:private-files`;
const NAME = /^[a-f0-9]{32}\.(jpg|png|gif|webp)$/;

function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.slice(0, 6).toString("ascii"))) return "gif";
  if (buf.length > 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

async function store(file) {
  if (!file?.buffer?.length) throw new ApiError(httpStatus.BAD_REQUEST, "No file provided");
  if (file.buffer.length > 10 * 1024 * 1024) throw new ApiError(httpStatus.PAYLOAD_TOO_LARGE, "Image exceeds 10MB");
  const ext = sniff(file.buffer);
  if (!ext) throw new ApiError(httpStatus.BAD_REQUEST, "File is not a valid JPG, PNG, GIF or WebP image");
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(PRIVATE_DIR, name), file.buffer, { flag: "wx", mode: 0o600 });
  return `${PREFIX}${name}`;
}

const sign = (name, exp) => crypto.createHmac("sha256", secret()).update(`${name}:${exp}`).digest("hex");

/** Turn a stored ref into a link valid for `ttl` seconds. Public URLs pass through. */
function signedUrl(ref, ttl = 600) {
  if (!ref || !String(ref).startsWith(PREFIX)) return ref || "";
  const name = String(ref).slice(PREFIX.length);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const base = (process.env.PUBLIC_API_URL || "http://localhost:7171").replace(/\/+$/, "");
  return `${base}/v1/files/private/${name}?exp=${exp}&sig=${sign(name, exp)}`;
}

function verify(name, exp, sig) {
  if (!NAME.test(String(name)) || !/^\d+$/.test(String(exp)) || !/^[a-f0-9]{64}$/.test(String(sig))) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return crypto.timingSafeEqual(Buffer.from(sign(name, exp)), Buffer.from(String(sig)));
}

const filePath = (name) => path.join(PRIVATE_DIR, path.basename(name));

module.exports = { store, signedUrl, verify, filePath, PRIVATE_DIR, PREFIX, NAME };
