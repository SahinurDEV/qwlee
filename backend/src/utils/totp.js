// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what Google Authenticator,
// 1Password, Authy etc. use. No dependency needed.
const crypto = require("crypto");

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

function codeAt(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}

/** Returns the matched time-step (for replay protection) or null. */
function verify(secret, code, { window = 1, now = Date.now() } = {}) {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c) || !secret) return null;
  const step = Math.floor(now / 30000);
  for (let w = -window; w <= window; w++) {
    const a = Buffer.from(codeAt(secret, step + w));
    if (crypto.timingSafeEqual(a, Buffer.from(c))) return step + w;
  }
  return null;
}

const otpauthUrl = (secret, account, issuer = "Qwlee Admin") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

module.exports = { generateSecret, verify, otpauthUrl, codeAt };
