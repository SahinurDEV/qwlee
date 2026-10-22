// Fields of a User that are safe to expose to anyone (public profiles,
// populated gig sellers, search suggestions). Never add email, balance,
// oneTimeCode, verification documents, ban details or moderation data.
const PUBLIC_USER_FIELDS = [
  "fullName",
  "username",
  "image",
  "coverImage",
  "location",
  "role",
  "intro",
  "about",
  "skills",
  "online",
  "lastSeen",
  "perHourRate",
  "responseTime",
  "language",
  "review",
  "isVerified",
  "isProfileCompleted",
  "createdAt",
];

const PUBLIC_USER_SELECT = PUBLIC_USER_FIELDS.join(" ");

const toPublicUser = (user) => {
  if (!user) return user;
  const obj = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  const out = { id: obj.id || obj._id };
  PUBLIC_USER_FIELDS.forEach((f) => {
    if (obj[f] !== undefined) out[f] = obj[f];
  });
  return out;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { PUBLIC_USER_FIELDS, PUBLIC_USER_SELECT, toPublicUser, escapeRegex };
