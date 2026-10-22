// Thin wrapper over the web-push library: VAPID config from env and an
// endpoint allow-list (the server POSTs to the subscription endpoint, so
// arbitrary URLs would be an SSRF vector).
const webpush = require("web-push");

const DEFAULT_HOSTS = "fcm.googleapis.com,updates.push.services.mozilla.com,*.push.apple.com,*.notify.windows.com";

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

function allowedHosts() {
  return String(process.env.PUSH_ENDPOINT_HOSTS || DEFAULT_HOSTS).split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function endpointAllowed(endpoint, hosts = allowedHosts()) {
  let u;
  try {
    u = new URL(String(endpoint));
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const h = u.hostname.toLowerCase();
  return hosts.some((p) => (p.startsWith("*.") ? h.endsWith(p.slice(1)) && h.length > p.length - 1 : h === p));
}

/** The exact HTTP request that would be sent (used by tests). */
function requestDetails(sub, payload, keys) {
  return webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
    vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
    TTL: 24 * 3600,
  });
}

/** Send one push. Resolves to {ok, gone}; never throws. */
async function send(sub, payload, keys = vapid(), opts = {}) {
  if (!keys) return { ok: false, gone: false, reason: "not_configured" };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
      { vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 24 * 3600, timeout: 8000, ...opts }
    );
    return { ok: true, gone: false };
  } catch (e) {
    return { ok: false, gone: e.statusCode === 404 || e.statusCode === 410, reason: e.statusCode ? `http_${e.statusCode} ${String(e.body || "").slice(0, 200)}` : e.message };
  }
}

module.exports = { requestDetails, vapid, endpointAllowed, allowedHosts, send, generateVAPIDKeys: webpush.generateVAPIDKeys };
