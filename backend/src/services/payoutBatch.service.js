// Batch payouts, bank export and bank reconciliation for finance.
//
// - approveBatch: approves several pending withdrawals one by one (each goes
//   through withdrawalApprove, so PayPal/Payoneer are sent and bank ones
//   are marked as paid manually). Amounts at or above the "second approval
//   over" setting are skipped: they still need the single four-eyes flow.
// - bankCsv: pending bank withdrawals as CSV for the bank's bulk upload.
// - reconcile: takes the bank's statement as CSV (reference = withdrawal
//   id, amount, status paid|failed, optional bank reference) and matches it.
//   Paid rows with the right amount are approved and stamped with the bank
//   reference; anything else is reported and left untouched.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { Withdrawal } = require("../models");
const siteSettings = require("./siteSettings.service");

const MAX = 100;

async function approvalLimit() {
  const site = await siteSettings.get();
  return Number(site.marketplace?.secondApprovalOver || 0);
}

async function approveBatch(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new ApiError(httpStatus.BAD_REQUEST, "ids must be a non-empty array");
  if (ids.length > MAX) throw new ApiError(httpStatus.BAD_REQUEST, `At most ${MAX} withdrawals per batch`);
  const { withdrawalApprove } = require("./withdrawal.service");
  const limit = await approvalLimit();
  const results = [];
  for (const id of [...new Set(ids.map(String))]) {
    if (!mongoose.isValidObjectId(id)) {
      results.push({ id, ok: false, error: "Invalid id" });
      continue;
    }
    const w = await Withdrawal.findById(id).select("withdrawalAmount status").lean();
    if (!w) results.push({ id, ok: false, error: "Not found" });
    else if (w.status !== "Pending") results.push({ id, ok: false, error: `Status is ${w.status}` });
    else if (limit && Number(w.withdrawalAmount) >= limit)
      results.push({ id, ok: false, error: `Needs second approval ($${limit} or more); approve it on its own` });
    else {
      try {
        const done = await withdrawalApprove(id);
        results.push({ id, ok: true, status: done.status, provider: done.payout?.provider });
      } catch (e) {
        results.push({ id, ok: false, error: e.message });
      }
    }
  }
  return { approved: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}

const cell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function bankCsv({ status = "Pending" } = {}) {
  if (!["Pending", "Processing", "Completed"].includes(status)) throw new ApiError(httpStatus.BAD_REQUEST, "Bad status");
  const rows = await Withdrawal.find({ method: { $in: ["bank", null] }, status })
    .sort({ createdAt: 1 })
    .populate("userId", "fullName email")
    .lean();
  const head = ["reference", "requested_at", "name", "email", "bank_name", "account_number", "account_type", "amount_usd"];
  const lines = [head.join(",")];
  for (const w of rows)
    lines.push(
      [String(w._id), new Date(w.createdAt).toISOString(), w.userId?.fullName, w.userId?.email, w.bankName, w.accountNumber, w.accountType, Number(w.withdrawalAmount).toFixed(2)]
        .map(cell)
        .join(",")
    );
  return { csv: lines.join("\n") + "\n", count: rows.length, total: rows.reduce((s, w) => s + Number(w.withdrawalAmount || 0), 0) };
}

// Minimal CSV parser (quoted fields, doubled quotes, CRLF).
function parseCsv(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

async function reconcile(csv, { dryRun = false } = {}) {
  if (typeof csv !== "string" || !csv.trim()) throw new ApiError(httpStatus.BAD_REQUEST, "csv is required");
  if (csv.length > 95000) throw new ApiError(httpStatus.BAD_REQUEST, "csv is too large; split it into smaller files");
  const [head, ...body] = parseCsv(csv);
  const cols = head.map((h) => h.trim().toLowerCase());
  const at = (names) => cols.findIndex((c) => names.includes(c));
  const iRef = at(["reference", "withdrawal_id", "id"]), iAmt = at(["amount", "amount_usd"]), iSt = at(["status"]), iBank = at(["bank_reference", "bank_ref", "transaction_id"]);
  if (iRef < 0 || iAmt < 0) throw new ApiError(httpStatus.BAD_REQUEST, "CSV needs 'reference' and 'amount' columns");
  if (body.length > 1000) throw new ApiError(httpStatus.BAD_REQUEST, "At most 1000 rows");
  const { withdrawalApprove } = require("./withdrawal.service");
  const results = [];
  for (const r of body) {
    const ref = (r[iRef] || "").trim();
    const amount = Number(String(r[iAmt] || "").replace(/[^0-9.\-]/g, ""));
    const st = iSt >= 0 ? (r[iSt] || "").trim().toLowerCase() : "paid";
    const bankRef = iBank >= 0 ? (r[iBank] || "").trim().slice(0, 100) : "";
    const out = { reference: ref, amount, bankReference: bankRef };
    const w = mongoose.isValidObjectId(ref) ? await Withdrawal.findById(ref).lean() : null;
    if (!w) { results.push({ ...out, result: "unknown" }); continue; }
    if ((w.method || "bank") !== "bank") { results.push({ ...out, result: "not-bank" }); continue; }
    if (Math.abs(Number(w.withdrawalAmount) - amount) > 0.005) { results.push({ ...out, result: "amount-mismatch", expected: w.withdrawalAmount }); continue; }
    if (!["paid", "completed", "success", "ok"].includes(st)) { results.push({ ...out, result: "bank-failed", status: w.status }); continue; }
    if (w.reconciledAt) { results.push({ ...out, result: "already-reconciled" }); continue; }
    if (!["Pending", "Completed"].includes(w.status)) { results.push({ ...out, result: "wrong-status", status: w.status }); continue; }
    if (dryRun) { results.push({ ...out, result: w.status === "Pending" ? "would-approve" : "would-match" }); continue; }
    try {
      if (w.status === "Pending") await withdrawalApprove(ref);
      await Withdrawal.updateOne({ _id: ref, reconciledAt: null }, { $set: { reconciledAt: new Date(), "payout.status": "reconciled", ...(bankRef ? { "payout.id": bankRef } : {}) } });
      results.push({ ...out, result: w.status === "Pending" ? "approved" : "matched" });
    } catch (e) {
      results.push({ ...out, result: "error", error: e.message });
    }
  }
  const summary = {};
  for (const r of results) summary[r.result] = (summary[r.result] || 0) + 1;
  return { dryRun: !!dryRun, rows: results.length, summary, results };
}

module.exports = { approveBatch, bankCsv, reconcile, parseCsv };
