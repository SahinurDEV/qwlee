// ImgBB cloud upload service.
//
// All image uploads go through this module. No file ever touches disk.
// Callers pass `{ buffer, originalname, mimetype }` (multer file object).
//
// On success returns { url, displayUrl, thumbUrl, deleteUrl }.
// On failure throws an ApiError with the upstream message.

const axios = require("axios");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");
const logger = require("../config/logger");

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 32 * 1024 * 1024; // ImgBB hard cap is 32MB.

function validate(file) {
  if (!file || !file.buffer) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No image file provided");
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new ApiError(
      httpStatus.UNSUPPORTED_MEDIA_TYPE,
      `Unsupported image type: ${file.mimetype}`
    );
  }
  if (file.buffer.length > MAX_BYTES) {
    throw new ApiError(
      httpStatus.PAYLOAD_TOO_LARGE,
      `Image exceeds ${MAX_BYTES / 1024 / 1024}MB limit`
    );
  }
}

// Detect the real image type from magic bytes (never trust the client).
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 6 && (buf.slice(0, 6).toString("ascii") === "GIF87a" || buf.slice(0, 6).toString("ascii") === "GIF89a")) return "gif";
  if (buf.length > 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || require("path").join(__dirname, "../../uploads");

// Fallback when no ImgBB key is configured: store on local disk (a
// Docker volume) and serve from <PUBLIC_API_URL>/uploads/<file>.
async function storeLocally(file) {
  const ext = sniff(file.buffer);
  if (!ext) throw new ApiError(httpStatus.BAD_REQUEST, "File is not a valid JPG, PNG, GIF or WebP image");
  const fs = require("fs/promises");
  const name = `${require("crypto").randomBytes(16).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(require("path").join(UPLOAD_DIR, name), file.buffer, { flag: "wx" });
  const base = (process.env.PUBLIC_API_URL || "http://localhost:7171").replace(/\/+$/, "");
  const url = `${base}/uploads/${name}`;
  return { url, displayUrl: url, thumbUrl: url, deleteUrl: null, raw: { local: true } };
}

async function uploadOne(file) {
  validate(file);

  const apiKey = config.imgbb.apiKey;
  if (!apiKey) return storeLocally(file);

  // ImgBB takes either base64 body or multipart form. Base64 is simpler
  // for in-memory buffers and dodges the multipart bookkeeping.
  const form = new URLSearchParams();
  form.set("key", apiKey);
  form.set("image", file.buffer.toString("base64"));
  if (file.originalname) form.set("name", file.originalname.slice(0, 96));

  try {
    const { data } = await axios.post(IMGBB_ENDPOINT, form, {
      timeout: 30000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    if (!data?.success) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        `ImgBB upload failed: ${data?.error?.message || "unknown error"}`
      );
    }
    return {
      url: data.data.url,
      displayUrl: data.data.display_url,
      thumbUrl: data.data.thumb?.url || data.data.url,
      deleteUrl: data.data.delete_url,
      // Keep the original for callers that want a flat schema.
      raw: data.data,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const upstream = err.response?.data?.error?.message || err.message;
    logger.error(`ImgBB upload error: ${upstream}`);
    throw new ApiError(httpStatus.BAD_GATEWAY, `ImgBB upload failed: ${upstream}`);
  }
}

async function uploadMany(files) {
  if (!Array.isArray(files) || files.length === 0) return [];
  // Sequential — keeps memory/network polite and surfaces failures fast.
  const out = [];
  for (const f of files) out.push(await uploadOne(f));
  return out;
}

module.exports = { uploadOne, uploadMany, ALLOWED_MIME, MAX_BYTES, UPLOAD_DIR, sniff };
