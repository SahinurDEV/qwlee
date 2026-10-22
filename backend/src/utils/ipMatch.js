// Tiny IP allowlist matcher: exact IPv4/IPv6 addresses and IPv4 CIDR.
const net = require("net");

const norm = (ip) => String(ip || "").replace(/^::ffff:/, "").trim();
const v4 = (ip) => ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;

function validEntry(e) {
  const [ip, bits] = String(e).split("/");
  if (!net.isIP(ip)) return false;
  if (bits === undefined) return true;
  return net.isIPv4(ip) && /^\d+$/.test(bits) && Number(bits) <= 32;
}

function matches(ip, entry) {
  const a = norm(ip);
  const [base, bits] = String(entry).split("/");
  if (bits === undefined) return a === norm(base);
  if (!net.isIPv4(a) || !net.isIPv4(base)) return false;
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (v4(a) & mask) === (v4(base) & mask);
}

const allowed = (ip, list) => !list?.length || list.some((e) => matches(ip, e));

module.exports = { validEntry, matches, allowed, norm };
