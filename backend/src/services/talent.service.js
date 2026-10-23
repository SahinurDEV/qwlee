// Talent search: buyers find sellers by name, skill, Pro status or rating,
// then invite them to a buyer request (buyerRequest.service.inviteSeller).
const { User } = require("../models");
const { PUBLIC_USER_SELECT, escapeRegex } = require("../utils/publicUser");

async function search(q = {}) {
  const filter = { role: "freelancer", isDeleted: { $ne: true }, bannedAt: null };
  const text = String(q.q || "").trim().slice(0, 80);
  if (text) {
    const rx = new RegExp(escapeRegex(text), "i");
    filter.$or = [{ fullName: rx }, { username: rx }, { intro: rx }, { skills: rx }];
  }
  if (q.skill) filter.skills = new RegExp(`^${escapeRegex(String(q.skill).slice(0, 60))}$`, "i");
  if (q.pro === "true") filter.isPro = true;
  if (q.online === "true") filter.online = true;
  const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 50);
  const page = Math.max(Number(q.page) || 1, 1);
  const [results, total] = await Promise.all([
    User.find(filter).select(PUBLIC_USER_SELECT).sort({ isPro: -1, online: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { results, page, limit, total };
}

module.exports = { search };
