// Qwlee Pro (Fiverr Pro / Toptal-style vetted tier) and the hiring
// concierge.
//   - Sellers apply with a headline, years of experience, portfolio links
//     and notable clients. Admins (users.moderate) approve or reject; an
//     approved seller gets isPro, a Pro badge and shows up under the
//     marketplace "Pro only" filter (?pro=true).
//   - Buyers can ask the concierge to find talent for them; the request
//     opens a support ticket that the team answers with a shortlist.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");

const plain = (s, max) => String(s || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
const MIN_YEARS = 2;

async function apply(user, body) {
  if (user.role !== "freelancer") throw new ApiError(httpStatus.FORBIDDEN, "Only sellers can apply for Pro");
  const u = await User.findById(user.id, "isPro proApplication");
  if (u.isPro) throw new ApiError(httpStatus.CONFLICT, "You're already Pro");
  if (u.proApplication?.status === "pending") throw new ApiError(httpStatus.CONFLICT, "Your application is being reviewed");
  const headline = plain(body.headline, 120);
  const years = Math.round(Number(body.experienceYears));
  const links = (Array.isArray(body.portfolioLinks) ? body.portfolioLinks : []).map((l) => String(l).trim()).filter(Boolean).slice(0, 10);
  if (headline.length < 10) throw new ApiError(httpStatus.BAD_REQUEST, "Headline needs 10+ characters");
  if (!(years >= MIN_YEARS && years <= 60)) throw new ApiError(httpStatus.BAD_REQUEST, `Pro needs at least ${MIN_YEARS} years of experience`);
  if (links.length < 2 || links.some((l) => !/^https?:\/\/\S+$/i.test(l) || l.length > 500)) throw new ApiError(httpStatus.BAD_REQUEST, "Add at least 2 portfolio links (http/https)");
  u.proApplication = { status: "pending", headline, experienceYears: years, portfolioLinks: links, clients: plain(body.clients, 500), submittedAt: new Date(), reviewedAt: null, reviewNote: "" };
  await u.save({ validateBeforeSave: false });
  return status(user.id);
}

async function status(userId) {
  const u = await User.findById(userId, "isPro proApplication").lean();
  return { isPro: !!u?.isPro, application: u?.proApplication || { status: "none" }, minYears: MIN_YEARS };
}

async function listApplications(st = "pending") {
  const results = await User.find({ "proApplication.status": st }, "fullName username email image proApplication isPro review").sort({ "proApplication.submittedAt": 1 }).limit(200).lean();
  return { results };
}

async function decide(userId, { approve, note }, admin) {
  const u = await User.findById(userId, "isPro proApplication role");
  if (!u || u.role !== "freelancer") throw new ApiError(httpStatus.NOT_FOUND, "Seller not found");
  if (approve === undefined) throw new ApiError(httpStatus.BAD_REQUEST, "approve is required");
  const yes = approve === true || approve === "true";
  if (u.proApplication?.status !== "pending" && yes) throw new ApiError(httpStatus.CONFLICT, "No pending application");
  u.isPro = yes;
  u.proApplication = { ...(u.proApplication?.toObject?.() || u.proApplication || {}), status: yes ? "approved" : "rejected", reviewedAt: new Date(), reviewNote: plain(note, 500) };
  await u.save({ validateBeforeSave: false });
  Notification.create({ receiverId: u._id, role: "freelancer", message: yes ? "You're now a Qwlee Pro seller" : `Your Pro application wasn't approved${note ? `: ${plain(note, 200)}` : ""}` }).catch(() => null);
  require("../config/logger").info(`pro ${yes ? "approved" : "rejected"} ${u._id} by ${admin?._id || admin?.id}`);
  return status(u._id);
}

async function concierge(user, body) {
  const brief = plain(body.brief, 3000);
  if (brief.length < 20) throw new ApiError(httpStatus.BAD_REQUEST, "Tell us about the project (20+ characters)");
  const budget = plain(body.budget, 60);
  const timeline = plain(body.timeline, 60);
  const ticket = await require("./support.service").createTicket({
    userId: user.id,
    subject: `Pro concierge: ${brief.slice(0, 80)}`,
    category: "other",
    body: `Concierge request\n\nBudget: ${budget || "—"}\nTimeline: ${timeline || "—"}\n\n${brief}`,
  });
  return { ticketId: String(ticket._id || ticket.id), message: "Our team will send you a shortlist of Pro sellers within 1 business day." };
}

module.exports = { apply, status, listApplications, decide, concierge };
