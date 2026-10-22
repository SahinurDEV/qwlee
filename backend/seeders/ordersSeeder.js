const { Orders, Payment } = require("../src/models");
const { pick, rand, daysAgo, daysFromNow, chance } = require("./utils/random");

// We create 14 orders spread across buyers/sellers/gigs with a realistic
// status mix: ~half delivered, some active, some late, a couple cancelled.
// Each order has a matching Payment record so the admin "payments" view
// has something to render.

const STATUS_DISTRIBUTION = [
  "delivered","delivered","delivered","delivered","delivered","delivered",
  "active","active","active",
  "late","late",
  "cancelled","cancelled",
  "delivered",
];

const REQUIREMENTS_TEMPLATES = [
  "Brand colors: deep navy + warm orange. Target audience: B2B procurement teams. Tone: confident, plain-spoken.",
  "Reference apps: Linear, Notion. Avoid: heavy gradients, illustration-heavy hero. Need dark mode from day one.",
  "Project deadline: hard date. We have a partner launch and can't slip. Please confirm timeline before starting.",
  "Repo access will be granted once we agree on scope. CI must stay green on every PR.",
  "I'd like a 15-min kickoff call to walk through requirements before you start work.",
  "Final deliverables: source files + a written changelog. Please don't squash commits.",
];

async function seedOrders({ buyers, sellers, gigs }) {
  const orderDocs = [];
  const paymentDocs = [];

  // The demo buyer always gets the first few orders so the demo account
  // (and the tests that sign in with it) never starts with an empty list.
  const demoBuyer = buyers.find((b) => b.email === "buyer@example.com");
  let demoOrders = 0;

  for (let i = 0; i < STATUS_DISTRIBUTION.length; i++) {
    const status = STATUS_DISTRIBUTION[i];
    const gig = pick(gigs);
    const seller = sellers.find(
      (s) => s._id.toString() === gig.userId.toString()
    );
    if (!seller) continue;
    const buyer = demoBuyer && demoOrders < 3 ? demoBuyer : pick(buyers);
    if (buyer === demoBuyer) demoOrders++;
    const pkg = pick(gig.package);
    const price = Number(pkg.price);
    const deliveryDays = Number(pkg.deliveryDate) || 7;

    // Older for delivered/cancelled, recent for active/late.
    const createdDaysAgo =
      status === "delivered" || status === "cancelled"
        ? rand(15, 90)
        : rand(1, 10);
    const createdAt = daysAgo(createdDaysAgo);
    const deliveryDate =
      status === "late"
        ? daysAgo(rand(1, 4))
        : status === "delivered"
        ? daysAgo(Math.max(1, createdDaysAgo - deliveryDays))
        : daysFromNow(deliveryDays);

    const orderData = {
      title: gig.title,
      packageName: pkg.name,
      requirements: pick(REQUIREMENTS_TEMPLATES),
      revisionsLeft: status === "delivered" ? 0 : rand(1, 3),
      package: pkg,
    };

    orderDocs.push({
      freelancerId: seller._id,
      clientId: buyer._id,
      gigId: gig._id,
      data: orderData,
      price,
      status,
      deliveryDate,
      createdAt,
      updatedAt: createdAt,
    });

    // Pair each order with a payment record. The frontend order detail page
    // resolves /orders/:id via Payment, so this is what users actually see —
    // include the rich `data` payload the redesigned page reads from
    // (requirements, package summary, revisions left).
    paymentDocs.push({
      sessionId: `cs_seed_${Date.now()}_${i}`,
      items: [
        {
          name: gig.title,
          price,
          quantity: 1,
          freelancerId: seller._id,
        },
      ],
      messageId: null,
      freelancerId: seller._id,
      clientId: buyer._id,
      gigId: gig._id,
      data: {
        title: gig.title,
        packageName: pkg.name,
        package: pkg,
        requirements: orderData.requirements,
        revisionsLeft: orderData.revisionsLeft,
        deliveryDays,
        status,
      },
      price,
      status,
      deliveryDate,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Manual insertion to preserve our createdAt overrides.
  const orders = await Orders.insertMany(orderDocs);
  const payments = await Payment.insertMany(paymentDocs);

  return { orders, payments };
}

module.exports = { seedOrders };
