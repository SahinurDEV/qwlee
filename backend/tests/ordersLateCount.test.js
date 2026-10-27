const test = require("node:test");
const assert = require("node:assert/strict");

// Lightweight pure check mirroring frontend isLateTabOrder / backend overdue rule.
function isLateTabOrder(o, now = new Date("2026-10-27T12:00:00Z")) {
  if (o.status === "late") return true;
  if (o.status !== "active") return false;
  if (!o.deliveryDate) return false;
  if ((o.delivery?.state || "none") === "submitted") return false;
  return new Date(o.deliveryDate) < now;
}

test("overdue active counts as late for the Late tab", () => {
  assert.equal(isLateTabOrder({ status: "active", deliveryDate: "2026-10-20", delivery: { state: "none" } }), true);
  assert.equal(isLateTabOrder({ status: "active", deliveryDate: "2026-10-20", delivery: { state: "submitted" } }), false);
  assert.equal(isLateTabOrder({ status: "active", deliveryDate: "2026-11-01" }), false);
  assert.equal(isLateTabOrder({ status: "late", deliveryDate: "2026-10-20" }), true);
  assert.equal(isLateTabOrder({ status: "delivered", deliveryDate: "2026-10-01" }), false);
});
