// Builds a redacted, citation-ready JSON payload for the dispute AI.
const httpStatus = require("http-status");
const ApiError = require("../../utils/ApiError");
const { Dispute, Payment, OrderMessage, Gig, User } = require("../../models");
const { maskContact } = require("../risk.service");
const policyCorpus = require("./policyCorpus");

const MSG_LIMIT = 80;

const partyBrief = (u, role) => {
  if (!u) return { role, id: null, name: "Unknown", accountAgeDays: null };
  const created = u.createdAt ? new Date(u.createdAt) : null;
  const age = created ? Math.max(0, Math.round((Date.now() - created.getTime()) / 86400000)) : null;
  return {
    role,
    id: String(u._id),
    name: u.fullName || u.username || "User",
    accountAgeDays: age,
    level: u.sellerLevel || u.level || null,
  };
};

const orderEvents = (order) => {
  const events = [];
  if (!order) return events;
  const push = (name, at, detail) => {
    if (at || detail) events.push({ id: `order.event:${name}`, name, at: at || null, detail: detail || "" });
  };
  push("created", order.createdAt, `price=${order.price}`);
  push("delivery_date", order.deliveryDate, "");
  if (order.requirementsStatus) push("requirements", order.requirementsSubmittedAt, order.requirementsStatus);
  if (order.delivery?.state && order.delivery.state !== "none") {
    push("delivery", order.delivery.lastDeliveredAt, `state=${order.delivery.state}; count=${order.delivery.count || 0}`);
  }
  (order.revisions || []).forEach((r, i) => push(`revision_${i + 1}`, r.requestedAt, r.reason || ""));
  if (order.extensionRequest?.status && order.extensionRequest.status !== "none") {
    push("extension", order.extensionRequest.requestedAt, `status=${order.extensionRequest.status}; reason=${order.extensionRequest.reason || ""}`);
  }
  if (order.cancellationRequest?.status && order.cancellationRequest.status !== "none") {
    push("cancellation_request", order.cancellationRequest.requestedAt, `status=${order.cancellationRequest.status}`);
  }
  if (order.escrow?.status) {
    push("escrow", order.escrow.heldAt || order.escrow.releasedAt || order.escrow.refundedAt, `status=${order.escrow.status}; amount=${order.escrow.amount ?? order.price}`);
  }
  if (order.completedAt) push("completed", order.completedAt, order.completionReason || "");
  if (order.cancelledAt) push("cancelled", order.cancelledAt, order.cancellationReason || "");
  return events;
};

const assembleContext = async (disputeId) => {
  const dispute = await Dispute.findById(disputeId)
    .populate("initiatorId", "fullName username role createdAt sellerLevel")
    .populate("responses.userId", "fullName username role");
  if (!dispute) throw new ApiError(httpStatus.NOT_FOUND, "Dispute not found");

  const order = await Payment.findById(dispute.orderId)
    .populate("clientId", "fullName username role createdAt")
    .populate("freelancerId", "fullName username role createdAt sellerLevel");
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");

  const gig = order.gigId
    ? await Gig.findById(order.gigId).select("title description package price extras")
    : null;

  const messages = await OrderMessage.find({ orderId: order._id })
    .sort({ createdAt: 1 })
    .limit(MSG_LIMIT)
    .populate("sender", "fullName username role");

  const buyerId = String(order.clientId?._id || order.clientId || "");
  const chat = messages.map((m) => {
    const sid = String(m.sender?._id || m.sender || "");
    const role = sid === buyerId ? "buyer" : sid === String(order.freelancerId?._id || order.freelancerId || "") ? "freelancer" : (m.sender?.role || "user");
    const content = m.content || {};
    const text = maskContact(content.message || "");
    const files = (content.files || []).map((f) => ({ name: f.path?.split("/").pop() || "file", type: f.fileType || "unknown" }));
    return {
      id: `chat.msg:${m._id}`,
      role,
      messageType: content.messageType || "text",
      text,
      files,
      deliveryDetails: content.messageType === "deliveryMessage" ? content.deliveryDetails || {} : undefined,
      extensionDetails: content.extensionDetails && Object.keys(content.extensionDetails || {}).length ? content.extensionDetails : undefined,
      createdAt: m.createdAt,
    };
  });

  const responses = (dispute.responses || []).map((r, i) => ({
    id: `dispute.response[${i}]`,
    role: r.role,
    message: maskContact(r.message || ""),
    proposedResolution: r.proposedResolution || null,
    attachments: (r.attachments || []).map((a) => (typeof a === "string" ? a.split("/").pop() : a?.name || "file")),
    createdAt: r.createdAt,
  }));

  const queryText = [dispute.reasonCode, dispute.description, ...responses.map((r) => r.message)].join(" ");
  const policyChunks = policyCorpus.retrieve(queryText, { limit: 8, reasonCode: dispute.reasonCode });

  const pkg = Array.isArray(gig?.package) ? gig.package : [];
  const packageSummary = pkg.slice(0, 3).map((p) => ({
    title: p.title || p.name || "package",
    description: String(p.description || "").slice(0, 400),
    price: p.price,
    deliveryDays: p.deliveryDays || p.deliveryTime,
    revisions: p.revision || p.revisions,
  }));

  return {
    dispute: {
      id: String(dispute._id),
      reasonCode: dispute.reasonCode,
      description: maskContact(dispute.description || ""),
      status: dispute.status,
      initiatorRole: dispute.initiatorRole,
      createdAt: dispute.createdAt,
      responses,
    },
    order: {
      id: String(order._id),
      price: order.price,
      status: order.status,
      deliveryDate: order.deliveryDate,
      escrowStatus: order.escrow?.status || null,
      escrowAmount: order.escrow?.amount ?? order.price,
      events: orderEvents(order),
    },
    gig: gig
      ? {
          id: String(gig._id),
          title: gig.title,
          description: String(gig.description || "").slice(0, 800),
          packages: packageSummary,
        }
      : null,
    parties: {
      buyer: partyBrief(order.clientId, "buyer"),
      seller: partyBrief(order.freelancerId, "freelancer"),
    },
    chat,
    policyChunks: policyChunks.map((c) => ({
      id: c.id,
      heading: c.heading,
      text: c.text,
    })),
    allowedOutcomes: ["full_refund", "partial_refund", "release_to_seller", "mutual_cancellation", "ask_for_more_info"],
  };
};

module.exports = { assembleContext, MSG_LIMIT };
