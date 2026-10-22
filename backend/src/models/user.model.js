const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const { toJSON, paginate } = require("./plugins");
const { roles } = require("../config/roles");

const userSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email");
        }
      },
    },
    gender: {
      type: String,
      required: false,
      enum: ["Male", "Female", "Other"],
    },
    username: {
      type: String,
      unique: true,
      trim: true,
      required: false,
      minLength: 3,
      maxLength: 24,
    },
    image: {
      type: String,
      // Empty string is now valid — the frontend Avatar component
      // generates an initials-based fallback when image is empty.
      required: false,
      default: "",
    },
    coverImage: {
      type: String,
      required: false,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      required: false,
      default: "",
    },
    password: {
      type: String,
      required: false,
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error(
            "Password must contain at least one letter and one number"
          );
        }
      },
      private: true, // used by the toJSON plugin
    },
    role: {
      type: String,
      enum: roles,
      default: "freelancer",
    },
    intro: {
      type: String,
      required: false,
      default: "",
    },
    about: {
      type: String,
      required: false,
      default: "",
    },
    balance: {
      type: Number,
      required: false,
      default: 0,
    },
    skills: {
      type: [],
      required: false,
      default: [],
    },
    online: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Google account subject id, set when the user signs in with Google.
    googleId: {
      type: String,
      private: true,
      index: { unique: true, sparse: true },
    },
    isResetPassword: {
      type: Boolean,
      default: false,
    },
    perHourRate: {
      type: String,
      required: false,
      default: "",
    },
    // Vacation mode: gigs leave search and new orders are blocked
    // between `from` and `until` (open-ended when `until` is null).
    availability: {
      away: { type: Boolean, default: false },
      from: { type: Date, default: null },
      until: { type: Date, default: null },
      message: { type: String, default: "", maxlength: 300 },
      allowMessages: { type: Boolean, default: true },
    },
    responseTime: {
      type: String,
      required: false,
      default: 0,
    },
    oneTimeCode: {
      type: String,
      required: false,
      private: true, // never serialised to clients
    },
    // One-time codes expire and lock after too many wrong guesses.
    oneTimeCodeExpiresAt: { type: Date, default: null, private: true },
    oneTimeCodeAttempts: { type: Number, default: 0, private: true },
    language: {
      type: String,
      required: false,
      default: "English",
    },
    review: {
      rating: {
        type: Number,
        required: false,
        default: 0.0,
      },
      total: {
        type: Number,
        required: false,
        default: 0.0,
      },
    },
    // Manual seller-level override set by an admin. When `tierId` is
    // a non-empty tier id (e.g. "level2"), the seller's computed level
    // is pinned to that tier and the qualifies-for-next progress hides.
    // Empty string = no override (default — derive from metrics).
    levelOverride: {
      tierId: { type: String, default: "" },
      reason: { type: String, default: "" },
      setBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "User",
        default: null,
      },
      setAt: { type: Date, default: null },
    },
    isDeleted: { type: Boolean, default: false },
    isBan: { type: Boolean, default: false },
    // Admin sub-role (only meaningful when role === "admin"). Missing
    // means "super" so existing admins keep full access.
    adminRole: { type: String, enum: ["super", "moderator", "support", "finance"], default: undefined },
    tokensValidAfter: { type: Date, default: null, private: true },
    // Reason shown on the sign-in page when a banned user tries to log
    // in. Set by the admin via PATCH /admin/users/:id/ban.
    banReason: { type: String, default: "" },
    bannedAt: { type: Date, default: null },
    // ID verification — seller submits docs, admin approves, the
    // verified tick mark shows up everywhere user.isVerified is true.
    isVerified: { type: Boolean, default: false },
    verification: {
      status: {
        type: String,
        enum: ["unsubmitted", "pending", "approved", "rejected"],
        default: "unsubmitted",
      },
      documentType: {
        type: String,
        enum: ["nid", "passport", ""],
        default: "",
      },
      documentNumber: { type: String, default: "" },
      frontUrl: { type: String, default: "" },
      backUrl: { type: String, default: "" },
      selfieUrl: { type: String, default: "" },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "User",
        default: null,
      },
      rejectionReason: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};
userSchema.statics.isPhoneNumberTaken = async function (
  phoneNumber,
  excludeUserId
) {
  const user = await this.findOne({ phoneNumber, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  // Accounts created with Google sign-in have no password until they set one.
  if (!user.password || typeof password !== "string") return false;
  return bcrypt.compare(password, user.password);
};

const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Check a submitted one-time code. Counts wrong attempts and burns the
 * code after OTP_MAX_ATTEMPTS or once it is older than OTP_TTL_MS.
 * Codes issued before this field existed (no expiry) are still honoured
 * once, for backward compatibility. Saves the user when state changes.
 * @returns {Promise<boolean>}
 */
userSchema.methods.checkOneTimeCode = async function (code) {
  if (!this.oneTimeCode) return false;
  const expired =
    this.oneTimeCodeExpiresAt && this.oneTimeCodeExpiresAt.getTime() < Date.now();
  if (expired || this.oneTimeCodeAttempts >= OTP_MAX_ATTEMPTS) {
    this.oneTimeCode = null;
    await this.save();
    return false;
  }
  if (String(code) !== String(this.oneTimeCode)) {
    this.oneTimeCodeAttempts = (this.oneTimeCodeAttempts || 0) + 1;
    if (this.oneTimeCodeAttempts >= OTP_MAX_ATTEMPTS) this.oneTimeCode = null;
    await this.save();
    return false;
  }
  return true;
};

userSchema.pre("save", async function (next) {
  const user = this;
  if (user.isModified("oneTimeCode")) {
    user.oneTimeCodeAttempts = 0;
    user.oneTimeCodeExpiresAt = user.oneTimeCode ? new Date(Date.now() + OTP_TTL_MS) : null;
  }
  if (user.isModified("password") && user.password) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

/**
 * @typedef User
 */
const User = mongoose.model("User", userSchema);

module.exports = User;
