// Sending approved withdrawals to PayPal or Payoneer.
//
// PayPal: with PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET set, an approved
// withdrawal is sent with the Payouts API (PAYPAL_ENV=live|sandbox, default
// sandbox). The withdrawal id is the sender_batch_id, so a retry cannot pay
// twice.
// Payoneer: with PAYONEER_API_TOKEN and PAYONEER_PROGRAM_ID set, it is sent
// with the Mass Payout API to the payee id the seller entered
// (PAYONEER_API_URL, default the sandbox).
// Without credentials the payout is recorded as "demo" (nothing is sent).
// Bank withdrawals are paid manually by the finance team, as before.
//
// Neither real provider has been exercised from this codebase; the request
// shapes follow the providers' public API docs.

const configured = {
  paypal: () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  payoneer: () => !!(process.env.PAYONEER_API_TOKEN && process.env.PAYONEER_PROGRAM_ID),
};

const status = () => ({
  paypal: configured.paypal() ? (process.env.PAYPAL_ENV === "live" ? "live" : "sandbox") : "demo",
  payoneer: configured.payoneer() ? "configured" : "demo",
});

async function paypal(w, fetchImpl = fetch) {
  const base = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tok = await fetchImpl(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tok.ok) throw new Error(`PayPal auth failed (${tok.status})`);
  const { access_token: token } = await tok.json();
  const res = await fetchImpl(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: `qwlee-${w._id}`, email_subject: "You have a payout from Qwlee" },
      items: [{ recipient_type: "EMAIL", receiver: w.payoutAccount, sender_item_id: String(w._id), amount: { value: Number(w.withdrawalAmount).toFixed(2), currency: "USD" } }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal payout failed (${res.status}): ${body?.message || body?.name || ""}`.trim());
  return { provider: "paypal", id: body?.batch_header?.payout_batch_id || "", status: String(body?.batch_header?.batch_status || "PENDING").toLowerCase() };
}

async function payoneer(w, fetchImpl = fetch) {
  const base = (process.env.PAYONEER_API_URL || "https://api.sandbox.payoneer.com").replace(/\/+$/, "");
  const res = await fetchImpl(`${base}/v4/programs/${encodeURIComponent(process.env.PAYONEER_PROGRAM_ID)}/masspayouts`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.PAYONEER_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      Payments: [{ client_reference_id: `qwlee-${w._id}`, payee_id: w.payoutAccount, amount: Number(w.withdrawalAmount), currency: "USD", description: "Qwlee earnings" }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Payoneer payout failed (${res.status}): ${body?.error_description || body?.description || ""}`.trim());
  return { provider: "payoneer", id: String(body?.result?.payout_id || body?.payout_id || `qwlee-${w._id}`), status: "pending" };
}

/** Send one withdrawal. Throws when a configured provider refuses it. */
async function send(w, fetchImpl) {
  const method = w.method || "bank";
  if (method === "bank") return { provider: "manual", id: "", status: "manual", at: new Date() };
  let result;
  if (configured[method]()) {
    result = method === "paypal" ? await paypal(w, fetchImpl) : await payoneer(w, fetchImpl);
  } else {
    require("../config/logger").info(`[payouts] demo ${method} payout of $${w.withdrawalAmount} to ${w.payoutAccount} (no credentials set)`);
    result = { provider: "demo", id: `demo_${method}_${w._id}`, status: "succeeded" };
  }
  return { ...result, at: new Date() };
}

module.exports = { send, status, _paypal: paypal, _payoneer: payoneer };
