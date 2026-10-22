// Enrichment seeder — fills in every "post-MVP" field on records
// already created by the earlier seeders, so the live UI shows
// realistic data for every feature.
//
// Run after the rest of the pipeline. Idempotent: re-running won't
// double-add. Safe to re-execute via `npm run seed`.

const mongoose = require("mongoose");
const {
  Gig,
  Reviews,
  User,
  Payment,
  SupportTicket,
  SupportMessage,
  SearchLog,
} = require("../src/models");
const { rand: randInt, pick: choice } = require("./utils/random");

const SEARCH_QUERIES = [
  { q: "logo designer", country: "United States", code: "US" },
  { q: "logo designer", country: "United Kingdom", code: "GB" },
  { q: "logo designer", country: "India", code: "IN" },
  { q: "Next.js developer", country: "United States", code: "US" },
  { q: "Next.js developer", country: "Germany", code: "DE" },
  { q: "Next.js developer", country: "Bangladesh", code: "BD" },
  { q: "React Native app", country: "Canada", code: "CA" },
  { q: "React Native app", country: "Australia", code: "AU" },
  { q: "SEO audit", country: "United Kingdom", code: "GB" },
  { q: "SEO audit", country: "United States", code: "US" },
  { q: "video editor", country: "United States", code: "US" },
  { q: "video editor", country: "Brazil", code: "BR" },
  { q: "video editor", country: "Philippines", code: "PH" },
  { q: "copywriter", country: "United States", code: "US" },
  { q: "copywriter", country: "United Kingdom", code: "GB" },
  { q: "WordPress fix", country: "India", code: "IN" },
  { q: "WordPress fix", country: "United States", code: "US" },
  { q: "Shopify store setup", country: "Australia", code: "AU" },
  { q: "Shopify store setup", country: "Canada", code: "CA" },
  { q: "AI chatbot", country: "United States", code: "US" },
  { q: "AI chatbot", country: "Singapore", code: "SG" },
  { q: "AI chatbot", country: "Germany", code: "DE" },
  { q: "Stripe integration", country: "United States", code: "US" },
  { q: "Stripe integration", country: "Netherlands", code: "NL" },
  { q: "landing page", country: "United States", code: "US" },
  { q: "landing page", country: "France", code: "FR" },
  { q: "brand identity", country: "United Kingdom", code: "GB" },
  { q: "explainer video", country: "United States", code: "US" },
  { q: "voiceover", country: "United States", code: "US" },
  { q: "voiceover", country: "Philippines", code: "PH" },
  { q: "Figma to HTML", country: "Pakistan", code: "PK" },
  { q: "Figma to HTML", country: "Ukraine", code: "UA" },
  { q: "Mobile app UI", country: "India", code: "IN" },
  { q: "Mobile app UI", country: "Brazil", code: "BR" },
  { q: "SaaS landing page", country: "United States", code: "US" },
  { q: "ICO whitepaper", country: "Switzerland", code: "CH" },
  { q: "social media manager", country: "Spain", code: "ES" },
  { q: "social media manager", country: "Italy", code: "IT" },
  { q: "Instagram reels editing", country: "United States", code: "US" },
  { q: "TikTok content", country: "United States", code: "US" },
];

const REVIEW_REPLIES = [
  "Thanks so much! It was a pleasure working with you — feel free to reach out if you need future revisions.",
  "Appreciate the kind words 🙏 Looking forward to the next project!",
  "Thank you for the trust. Glad we got everything dialed in.",
  "Cheers! Always great working with clients who know what they want.",
  "Thanks for being so responsive throughout — made the whole project smoother.",
  "Means a lot, thank you. Hit me up any time.",
];

async function enrich() {
  console.log("→ enriching seeded data");

  // 1. Gig stats + status variety. Deterministic distribution so the
  //    admin "Gigs" tabs and the seller dashboard tabs all have at
  //    least one example to look at — the dataset is small (~17 gigs)
  //    so pure random doesn't reliably hit every status.
  // Reviewed gigs go to the back of the queue so they stay active: the
  // order seeder picks gigs at random, and without this every reviewed
  // gig could end up paused or pending, leaving search with no rated gig.
  // The demo seller's gigs go last too: tests and demos need the seller
  // used for sign-in to have active gigs (with extras) to order.
  const reviewedIds = new Set((await Reviews.distinct("gigId")).map(String));
  const demoSeller = await User.findOne({ email: "seller@example.com" }).select("_id").lean();
  const keep = (g) => reviewedIds.has(String(g._id)) || String(g.userId) === String(demoSeller?._id);
  const gigs = (await Gig.find({}).sort({ createdAt: -1 }).lean()).sort((a, b) => keep(a) - keep(b));
  const STATUS_SCHEDULE = [
    { status: "pending", count: 2 },
    { status: "paused", count: 2 },
    { status: "requires-modification", count: 1 },
    { status: "draft", count: 1 },
  ];
  // Build a map: gigIndex → status. Earliest gigs get active (the
  // long-running ones); the rest cycle through the schedule.
  const statusByIndex = new Map();
  let i = 0;
  for (const slot of STATUS_SCHEDULE) {
    for (let c = 0; c < slot.count && i < gigs.length; c++) {
      statusByIndex.set(i++, slot.status);
    }
  }
  let pendingCount = 0;
  let pausedCount = 0;
  let reqModCount = 0;
  let draftCount = 0;
  for (let idx = 0; idx < gigs.length; idx++) {
    const g = gigs[idx];
    const status = statusByIndex.get(idx) || "active";
    if (status === "pending") pendingCount++;
    if (status === "paused") pausedCount++;
    if (status === "requires-modification") reqModCount++;
    if (status === "draft") draftCount++;
    const impressions = randInt(80, 950);
    const clicks = randInt(8, Math.max(15, Math.floor(impressions * 0.18)));
    const update = {
      gigStatus: status,
      "stats.impressions": impressions,
      "stats.clicks": clicks,
    };
    if (status === "requires-modification") {
      update.moderation = {
        reason:
          "Cover image is too small. Please upload at least 1280×769 px in JPG or PNG.",
        reviewedAt: new Date(),
        reviewedBy: null,
      };
    }
    await Gig.updateOne({ _id: g._id }, { $set: update });
  }
  console.log(
    `  ✓ ${gigs.length} gigs decorated with impressions/clicks (${pendingCount} pending, ${pausedCount} paused, ${reqModCount} needs-changes, ${draftCount} draft)`
  );

  // 2. Reviews — backfill orderId from a matching Payment, and add a
  //    seller reply to ~50% of reviews.
  const reviews = await Reviews.find({}).lean();
  let withOrder = 0;
  let withReply = 0;
  for (const r of reviews) {
    const updates = {};
    if (!r.orderId) {
      const matching = await Payment.findOne({
        clientId: r.userId,
        freelancerId: r.freelancerId,
        gigId: r.gigId,
      })
        .select("_id")
        .lean();
      if (matching?._id) {
        updates.orderId = matching._id;
        withOrder++;
      }
    }
    // Reply to ~70% of reviews — Fiverr sellers reply often, and we
    // want the gig detail page to surface plenty of examples.
    if (!r.sellerReply?.message && Math.random() < 0.7) {
      updates.sellerReply = {
        message: choice(REVIEW_REPLIES),
        repliedAt: new Date(
          Date.now() - randInt(1, 30) * 24 * 60 * 60 * 1000
        ),
      };
      withReply++;
    }
    if (Object.keys(updates).length) {
      await Reviews.updateOne({ _id: r._id }, { $set: updates });
    }
  }
  console.log(
    `  ✓ reviews enriched (orderId on ${withOrder}, seller reply on ${withReply})`
  );

  // 3. Verified sellers — pick the 3 highest-rated freelancers and
  //    mark them ID-verified so the verified tick shows on their
  //    profiles, gigs, and chats.
  const topSellers = await User.find({ role: "freelancer", isDeleted: { $ne: true } })
    .sort({ "review.rating": -1, "review.total": -1 })
    .limit(3);
  for (const s of topSellers) {
    s.isVerified = true;
    s.verification = {
      status: "approved",
      documentType: "passport",
      documentNumber: `P${randInt(1000000, 9999999)}`,
      frontUrl: "",
      backUrl: "",
      selfieUrl: "",
      submittedAt: new Date(Date.now() - 25 * 86400000),
      reviewedAt: new Date(Date.now() - 22 * 86400000),
      reviewedBy: null,
      rejectionReason: "",
    };
    await s.save();
  }
  console.log(`  ✓ ${topSellers.length} sellers marked ID-verified`);

  // 4. Order extension requests on one active order + cancellation
  //    audit fields on one cancelled order.
  const activeOrders = await Payment.find({ status: { $in: ["active", "late"] } })
    .limit(2)
    .lean();
  if (activeOrders[0]) {
    await Payment.updateOne(
      { _id: activeOrders[0]._id },
      {
        $set: {
          extensionRequest: {
            newDeliveryDate: new Date(
              new Date(activeOrders[0].deliveryDate).getTime() +
                5 * 86400000
            ),
            reason:
              "Need 5 extra days to incorporate the additional brand assets you sent last week.",
            status: "pending",
            requestedAt: new Date(Date.now() - 1 * 86400000),
            respondedAt: null,
          },
        },
      }
    );
    console.log("  ✓ extension request added to an active order");
  }
  const cancelledOrder = await Payment.findOne({ status: "cancelled" });
  if (cancelledOrder) {
    cancelledOrder.cancellationReason =
      "[Admin override] Buyer reported scope mismatch; refund processed.";
    cancelledOrder.cancelledAt = new Date(Date.now() - 5 * 86400000);
    cancelledOrder.cancelledFromStatus = "active";
    await cancelledOrder.save();
    console.log("  ✓ cancellation audit fields added");
  }

  // 5. Search logs — backfill with realistic queries and countries so
  //    Trending + /dashboard/searches stats look real.
  const existingSearches = await SearchLog.countDocuments({});
  const buyers = await User.find({ role: "buyer", isDeleted: { $ne: true } })
    .select("_id")
    .lean();
  if (existingSearches < 80) {
    const rows = [];
    const total = 80 - existingSearches;
    for (let i = 0; i < total; i++) {
      const sample = choice(SEARCH_QUERIES);
      const isAuth = Math.random() < 0.35;
      const minutesAgo = randInt(5, 60 * 24 * 7);
      rows.push({
        query: sample.q.toLowerCase(),
        displayQuery: sample.q,
        userId: isAuth && buyers.length ? choice(buyers)._id : null,
        ip: `${randInt(1, 200)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
        country: sample.country,
        countryCode: sample.code,
        city: "",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        referer: "",
        route: "/gig",
        createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
      });
    }
    await SearchLog.insertMany(rows);
    console.log(`  ✓ ${rows.length} realistic search logs added`);
  }

  // 6. Admin-initiated support ticket on a real order — so the
  //    multi-participant mediation flow has an example.
  const adminUser = await User.findOne({ role: "admin" });
  const sampleOrder = await Payment.findOne({ status: "delivered" });
  const existingAdminTicket = await SupportTicket.findOne({
    openedByRole: "admin",
  });
  if (adminUser && sampleOrder && !existingAdminTicket) {
    const ticket = await SupportTicket.create({
      userId: sampleOrder.clientId,
      participants: [sampleOrder.clientId, sampleOrder.freelancerId],
      openedBy: adminUser._id,
      openedByRole: "admin",
      orderId: sampleOrder._id,
      reason: "Quality dispute mediation",
      subject: "Mediation on your recent order",
      category: "orders",
      status: "open",
      unreadByAdmin: 0,
      unreadByUser: 1,
      lastMessageAt: new Date(),
    });
    await SupportMessage.create({
      ticketId: ticket._id,
      senderId: adminUser._id,
      senderRole: "admin",
      body:
        "Hi both, this thread is for resolving the concern raised about the recent delivery. Please share your side here within 48 hours and we'll mediate a fair outcome.",
    });
    console.log("  ✓ admin-mediated support ticket created");
  }

  console.log("→ enrichment complete");
  return {};
}

module.exports = { seedEnrich: enrich };
