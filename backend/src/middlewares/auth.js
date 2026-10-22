const passport = require("passport");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { roleRights } = require("../config/roles");
const jwt = require("jsonwebtoken");

const verifyCallback =
  (req, res, resolve, reject, requiredRights) => async (err, user, info) => {
    if (err || info || !user) {
      return reject(
        new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized")
      );
    }
    req.user = user;
    const { authorization } = req.headers;
    let token;
    let decodedData;
    if (authorization && authorization.startsWith("Bearer")) {
      token = authorization.split(" ")[1];
      decodedData = jwt.decode(token);
    }
    if (requiredRights.length) {
      const userRights = roleRights.get(user.role);
      const hasRequiredRights = requiredRights.every((requiredRight) =>
        userRights.includes(requiredRight)
      );
      // The "own userId" exception never applies to admin-only routes
      // (it let a seller hit /admin/seller-levels/<self>/override).
      const adminOnly = requiredRights.includes("admin");
      if (!hasRequiredRights && (adminOnly || req.params.userId !== user.id)) {
        return reject(new ApiError(httpStatus.FORBIDDEN, "Forbidden"));
      }
      if (adminOnly) {
        const perms = require("../config/adminPermissions");
        const r = perms.resolve(req);
        const sec = (await require("../services/siteSettings.service").get()).security || {};
        // A second-admin approval is replayed from 127.0.0.1; the approver
        // already passed this check on the approve call itself.
        const replay = req.get("x-approval-id") && /^[a-f0-9]{24}$/.test(req.get("x-approval-id")) &&
          (await require("../models/approval.model").exists({ _id: req.get("x-approval-id"), status: "approved", consumed: false,
            decidedBy: user._id, decidedAt: { $gt: new Date(Date.now() - 60 * 1000) } }));
        if (!replay && !require("../utils/ipMatch").allowed(req.ip, sec.adminIpAllowlist)) {
          require("./adminAudit").recordAdminAction(req, res, { ...r, perm: "ip-allowlist (denied)" });
          return reject(new ApiError(httpStatus.FORBIDDEN, "Admin access is not allowed from this network"));
        }
        const twoFaFree = /^\/admin\/(me|2fa)(\/|$)/.test(r.path || "");
        if (sec.requireAdmin2fa && !user.twoFactorEnabled && !twoFaFree) {
          return reject(new ApiError(httpStatus.FORBIDDEN, "TWO_FACTOR_SETUP_REQUIRED: turn on two-factor sign-in to use the admin panel"));
        }
        if (!perms.can(user, r.perm)) {
          require("./adminAudit").recordAdminAction(req, res, { ...r, perm: `${r.perm} (denied)` });
          return reject(new ApiError(httpStatus.FORBIDDEN, `Your admin role (${perms.roleOf(user)}) cannot do this`));
        }
        if (r.audit) require("./adminAudit").recordAdminAction(req, res, r);
      }
    }
    resolve();
  };

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate(
        "jwt",
        { session: false },
        verifyCallback(req, res, resolve, reject, requiredRights)
      )(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

module.exports = auth;
