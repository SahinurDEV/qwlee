// Local uploads look like ".../uploads/<name>" (public) or "private:<name>".
// Collect every such name from any nested value and unlink it. Files on
// ImgBB/Cloudinary can't be deleted from here (no delete token is kept).
function localNames(value, out = new Set()) {
  if (!value) return out;
  if (typeof value === "string") {
    const m = value.match(/(?:\/uploads\/|^private:)([A-Za-z0-9._-]+)$/);
    if (m && !m[1].startsWith(".")) out.add(m[1]);
  } else if (Array.isArray(value)) value.forEach((v) => localNames(v, out));
  else if (typeof value === "object") Object.values(value).forEach((v) => localNames(v, out));
  return out;
}
module.exports = { localNames };
