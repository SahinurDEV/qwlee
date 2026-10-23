// Finance tools on the Withdrawals page: bank CSV export and bank
// statement reconciliation (POST /withdrawal/reconcile, dry run first).
import { useState } from "react";
import { Modal } from "antd";
import toast from "react-hot-toast";
import url from "../../baseUrl";
import Button from "../../common/Button";

const auth = () => ({ authorization: `Bearer ${localStorage.getItem("token")}`, "ngrok-skip-browser-warning": "1" });

export async function exportBankCsv() {
  const res = await fetch(`${url}/v1/withdrawal/export/bank.csv?status=Pending`, { headers: auth() });
  if (!res.ok) return toast.error("Could not export");
  const n = res.headers.get("x-row-count");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bank-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success(`Exported ${n ?? ""} pending bank payouts`);
}

export async function batchApprove(ids) {
  const res = await fetch(`${url}/v1/withdrawal/batch/approve`, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || "Batch failed");
  return j.data.attributes;
}

const LABELS = {
  "would-approve": "Will be approved",
  "would-match": "Matches an approved payout",
  approved: "Approved",
  matched: "Matched",
  "amount-mismatch": "Amount differs",
  unknown: "Unknown reference",
  "not-bank": "Not a bank payout",
  "bank-failed": "Bank reports failed",
  "already-reconciled": "Already reconciled",
  "wrong-status": "Wrong status",
  error: "Error",
};

export function ReconcileModal({ open, onClose, onDone }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(dryRun) {
    setBusy(true);
    try {
      const res = await fetch(`${url}/v1/withdrawal/reconcile`, {
        method: "POST",
        headers: { ...auth(), "content-type": "application/json" },
        body: JSON.stringify({ csv, dryRun }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Could not reconcile");
      setPreview(j.data.attributes);
      if (!dryRun) {
        toast.success("Statement applied");
        onDone?.();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    setCsv("");
    setPreview(null);
    onClose();
  };
  return (
    <Modal open={open} onCancel={close} footer={null} title="Reconcile bank statement" width={720}>
      <p className="text-sm text-ink-600 mb-2">
        Upload the bank's CSV with columns <code>reference</code> (withdrawal id), <code>amount</code>, and optionally{" "}
        <code>status</code> (paid/failed) and <code>bank_reference</code>. Paid rows with the right amount are approved; everything else is
        listed for you to check.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="Statement file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setCsv(await f.text());
          setPreview(null);
        }}
        className="text-sm mb-2"
      />
      <textarea
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPreview(null);
        }}
        rows={6}
        aria-label="Statement CSV"
        placeholder="reference,amount,status,bank_reference"
        className="w-full border border-ink-200 rounded-lg p-2 font-mono text-xs"
      />
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" disabled={!csv.trim()} loading={busy} onClick={() => run(true)}>
          Preview
        </Button>
        <Button disabled={!preview?.dryRun} loading={busy} onClick={() => run(false)}>
          Apply
        </Button>
      </div>
      {preview && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">
            {preview.dryRun ? "Preview" : "Result"}:{" "}
            {Object.entries(preview.summary).map(([k, v]) => `${LABELS[k] || k} ${v}`).join(" · ")}
          </div>
          <div className="max-h-64 overflow-auto border border-ink-100 rounded-lg">
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead className="bg-ink-50 text-left">
                <tr><th className="p-2">Reference</th><th className="p-2">Amount</th><th className="p-2">Bank ref</th><th className="p-2">Result</th></tr>
              </thead>
              <tbody>
                {preview.results.map((r, i) => (
                  <tr key={i} className="border-t border-ink-100">
                    <td className="p-2 font-mono">{r.reference}</td>
                    <td className="p-2">${r.amount}{r.expected != null ? ` (expected $${r.expected})` : ""}</td>
                    <td className="p-2">{r.bankReference}</td>
                    <td className="p-2">{LABELS[r.result] || r.result}{r.error ? `: ${r.error}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
