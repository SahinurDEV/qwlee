// Shared bits for the control pages.
import { Modal } from "antd";
import toast from "react-hot-toast";
import cls from "../../utils/cls";
import { adminFetch } from "../../utils/adminApi";
import { confirmModal } from "../../common/confirm";

export const input = "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500";
export const select = input + " bg-white";

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-ink-700 mb-1">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-ink-500 mt-1">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {hint ? <span className="block text-xs text-ink-500">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        onClick={() => onChange(!checked)}
        className={cls("relative inline-flex h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-ink-200")}
      >
        <span className={cls("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.v}
          type="button"
          onClick={() => onChange(t.v)}
          className={cls("px-3 h-8 rounded-lg text-xs font-semibold transition", value === t.v ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pager({ data, page, setPage }) {
  if (!data || data.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-xs text-ink-600">
      <span>
        Page {page} of {data.totalPages} · {data.totalResults} total
      </span>
      <div className="flex gap-2">
        <button className="h-8 px-3 rounded-lg border border-ink-200 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button className="h-8 px-3 rounded-lg border border-ink-200 disabled:opacity-40" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

// Confirm (optionally asking for a reason), call the API, toast, reload.
export async function act({ title, description, danger, path, method = "POST", body, askReason, done, success }) {
  let reason;
  if (askReason) {
    reason = await promptText({ title, description, placeholder: askReason });
    if (reason === null) return;
  } else if (!(await confirmModal({ title, description, danger, confirmText: "Confirm" }))) return;
  try {
    const r = await adminFetch(path, { method, body: askReason ? { ...(body || {}), reason } : body });
    if (r?.needsApproval) toast("Sent to another admin for approval (Admin → Approvals).");
    else toast.success(r?.note || success || "Done");
    done?.(r);
  } catch (e) {
    toast.error(e.message);
  }
}

// Ban dialog: reason plus duration. Resolves {reason, days} or null.
export function promptBan({ title = "Ban user", count } = {}) {
  return new Promise((resolve) => {
    let reason = "";
    let days = "";
    Modal.confirm({
      title,
      centered: true,
      okText: "Ban",
      okButtonProps: { danger: true },
      content: (
        <div className="space-y-2">
          <p className="text-sm text-ink-600">{count ? `${count} accounts will` : "They will"} be signed out and blocked. The reason is emailed and shown when they try to sign in, and they can appeal.</p>
          <textarea autoFocus rows={3} aria-label="Ban reason" className="w-full rounded-lg border border-ink-200 p-2 text-sm" placeholder="Reason shown to the user" onChange={(e) => (reason = e.target.value)} />
          <label className="text-sm flex items-center gap-2">Duration
            <select aria-label="Ban duration" defaultValue="" onChange={(e) => (days = e.target.value)} className="border border-ink-200 rounded-lg px-2 py-1 text-sm">
              <option value="">Permanent</option>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </label>
        </div>
      ),
      onOk: () => resolve({ reason, days: days ? Number(days) : undefined }),
      onCancel: () => resolve(null),
    });
  });
}

export function promptText({ title, description, placeholder }) {
  return new Promise((resolve) => {
    let value = "";
    Modal.confirm({
      title,
      centered: true,
      okText: "Confirm",
      okButtonProps: { style: { backgroundColor: "#059669", borderColor: "#059669" } },
      content: (
        <div className="space-y-2">
          {description ? <p className="text-sm text-ink-600">{description}</p> : null}
          <textarea
            autoFocus
            rows={3}
            className="w-full rounded-lg border border-ink-200 p-2 text-sm"
            placeholder={placeholder}
            onChange={(e) => (value = e.target.value)}
          />
        </div>
      ),
      onOk: () => resolve(value),
      onCancel: () => resolve(null),
    });
  });
}

export const Empty = ({ children = "Nothing here yet." }) => <p className="py-10 text-center text-sm text-ink-500">{children}</p>;
export const ErrorNote = ({ error }) =>
  error ? (
    <p className="rounded-lg bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">
      {error.status === 403 ? "Your admin role doesn't have access to this section." : error.message}
    </p>
  ) : null;

export function Th({ children, className = "" }) {
  return <th className={cls("px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500", className)}>{children}</th>;
}
export function Td({ children, className = "" }) {
  return <td className={cls("px-3 py-2.5 text-sm text-ink-800 align-top", className)}>{children}</td>;
}
