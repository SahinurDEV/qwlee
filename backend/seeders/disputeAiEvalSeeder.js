// Seeds ~20 tagged dispute eval cases into the LOCAL docker DB only.
// Tag: demoSeed: true AND evalCase: "E0N". Safe to re-run (upserts by evalCase).
const mongoose = require("mongoose");
const { Dispute, Payment, User, OrderMessage } = require("../src/models");
const cases = require("./disputeAi/evalCases.json");

async function seedDisputeAiEval() {
  const buyer = await User.findOne({ email: "buyer@example.com" });
  const seller = await User.findOne({ email: "seller@example.com" });
  if (!buyer || !seller) {
    console.warn("disputeAiEval: buyer/seller demo users missing — skip");
    return { created: 0 };
  }

  let created = 0;
  for (const c of cases) {
    const existing = await Dispute.findOne({ evalCase: c.id });
    if (existing) continue;

    const order = await Payment.create({
      sessionId: `eval-${c.id}-${Date.now()}`,
      items: [{ name: `Eval ${c.id}`, price: 100, quantity: 1, freelancerId: seller._id }],
      freelancerId: seller._id,
      clientId: buyer._id,
      data: { evalCase: c.id, demoSeed: true, scenario: c.scenario },
      price: 100,
      status: "disputed",
      deliveryDate: new Date(Date.now() - 7 * 86400000),
      escrow: { status: "held", amount: 100, heldAt: new Date() },
      demoSeed: true,
    });

    const responses = [];
    if (c.buyerMsg) {
      responses.push({
        userId: buyer._id,
        role: "buyer",
        message: c.buyerMsg,
        createdAt: new Date(Date.now() - 2 * 86400000),
      });
    }
    if (c.sellerMsg) {
      responses.push({
        userId: seller._id,
        role: "freelancer",
        message: c.sellerMsg,
        createdAt: new Date(Date.now() - 1 * 86400000),
      });
    }

    const dispute = await Dispute.create({
      orderId: order._id,
      initiatorId: buyer._id,
      initiatorRole: "buyer",
      reasonCode: c.reasonCode === "other" && c.expected === "mutual_cancellation" ? "other" : c.reasonCode,
      description: `${c.scenario} [eval ${c.id}]`,
      status: "escalated",
      responses: responses.length
        ? responses
        : [{ userId: buyer._id, role: "buyer", message: c.scenario }],
      demoSeed: true,
      evalCase: c.id,
      expectedOutcome: c.expected,
    });

    order.activeDisputeId = dispute._id;
    await order.save();

    if (c.buyerMsg) {
      await OrderMessage.create({
        orderId: order._id,
        sender: buyer._id,
        receiver: seller._id,
        content: { messageType: "text", message: c.buyerMsg },
      });
    }
    if (c.sellerMsg) {
      await OrderMessage.create({
        orderId: order._id,
        sender: seller._id,
        receiver: buyer._id,
        content: { messageType: "text", message: c.sellerMsg },
      });
    }
    created += 1;
  }
  console.log(`disputeAiEval: created ${created} / ${cases.length}`);
  return { created, total: cases.length };
}

module.exports = { seedDisputeAiEval, cases };
