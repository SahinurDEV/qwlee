// Admin sub-roles and what each may do. Every route guarded with
// auth("admin") is mapped to one permission by RULES (first match wins).
// Unmatched GETs need "read"; unmatched writes need "*" (super only), so a
// new admin endpoint is locked down until it is added here.

const ROLE_PERMISSIONS = {
  super: ["*"],
  moderator: ["read", "users.moderate", "gigs.write", "moderation", "content", "support", "broadcast", "analytics"],
  support: ["read", "support", "disputes", "analytics"],
  finance: ["read", "orders.write", "finance", "disputes", "analytics"],
};
const ADMIN_ROLES = Object.keys(ROLE_PERMISSIONS);

// [methods ("*" = any, "W" = any non-GET), path regex, permission, audit GETs?]
const RULES = [
  // Any admin manages their own two-factor.
  ["*", /^\/admin\/2fa(\/|$)/, "read"],
  ["*", /^\/admin\/(settings|team|audit)(\/|$)/, "settings"],
  ["*", /^\/admin\/(chats|order-chats)(\/|$)/, "support", true],
  ["GET", /^\/admin\/users\/[^/]+\/view$/, "read", true],
  ["W", /^\/admin\/users\/[^/]+\/role$/, "settings"],
  ["W", /^\/admin\/users(\/|$)/, "users.moderate"],
  ["W", /^\/admin\/seller-levels(\/|$)/, "users.moderate"],
  ["W", /^\/admin\/gigs(\/|$)/, "gigs.write"],
  ["W", /^\/admin\/orders\/[^/]+\/(cancel|refund|complete)$/, "orders.write"],
  ["W", /^\/withdrawal(\/|$)/, "finance"],
  ["W", /^\/dispute(s)?(\/|$)/, "disputes"],
  ["W", /^\/admin\/(requests|offers|reviews)(\/|$)/, "moderation"],
  ["W", /^\/verification(\/|$)/, "moderation"],
  ["W", /^\/(categories|blog|banner|info)(\/|$)/, "content"],
  ["W", /^\/(admin\/)?support(\/|$)/, "support"],
  ["W", /^\/admin\/broadcast(\/|$)/, "broadcast"],
  // The approvals controller checks the permission of the parked action.
  ["W", /^\/admin\/approvals\/[^/]+\/(approve|reject)$/, "read"],
  ["GET", /^\/admin\/(escrow|payments|earnings)(\/|$)/, "finance"],
  ["GET", /^\/withdrawal(\/|$)/, "finance"],
  ["GET", /^\/admin\/newsletter(\/|$)/, "broadcast"],
  ["GET", /^\/admin\/analytics(\/|$)/, "analytics"],
];

const roleOf = (user) => (ADMIN_ROLES.includes(user?.adminRole) ? user.adminRole : "super");
const can = (user, perm) => {
  const perms = ROLE_PERMISSIONS[roleOf(user)] || [];
  return perms.includes("*") || perms.includes(perm);
};

// Path relative to the API version prefix, e.g. "/admin/users/123/ban".
const apiPath = (req) => (req.originalUrl || "").split("?")[0].replace(/^\/(api\/)?v1/, "");

function resolve(req) {
  const path = apiPath(req);
  const write = req.method !== "GET" && req.method !== "HEAD";
  for (const [m, re, perm, auditRead] of RULES) {
    const methodOk = m === "*" || (m === "W" ? write : req.method === m);
    if (methodOk && re.test(path)) return { perm, audit: write || !!auditRead, path };
  }
  return { perm: write ? "*" : "read", audit: write, path };
}

module.exports = { ROLE_PERMISSIONS, ADMIN_ROLES, RULES, roleOf, can, resolve, apiPath };
