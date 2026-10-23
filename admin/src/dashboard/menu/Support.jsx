// /dashboard/support — admin ticket inbox.
//
// Two-pane: list on the left (filterable by status), thread on the
// right with the same chat composer the user sees, plus an admin-only
// status switcher (Open / Pending / Resolved / Closed).

import { useMemo, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { TbSend, TbCircleCheck, TbProgressX, TbLock } from "react-icons/tb";
import toast from "react-hot-toast";

import {
  useGetSupportTicketsQuery,
  useGetSupportTicketQuery,
  usePostSupportMessageMutation,
  useUpdateSupportStatusMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import cls from "../../utils/cls";
import { formatDate, timeAgo, truncate } from "../../utils/format";
import getImageUrl from "../../utils/getImageUrl";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";

const STATUS_TABS = [
  { v: "all", label: "All" },
  { v: "open", label: "Open" },
  { v: "pending", label: "Pending" },
  { v: "resolved", label: "Resolved" },
  { v: "closed", label: "Closed" },
];

const STATUS_TO_PILL = {
  open: "active",
  pending: "pending",
  resolved: "info",
  closed: "muted",
};

export default function Support() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);

  const { data, isFetching } = useGetSupportTicketsQuery({
    status: tab === "all" ? undefined : tab,
  });
  const tickets = data?.results || [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      [t.subject, t.userId?.fullName, t.userId?.username, t.userId?.email]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [tickets, search]);

  const { data: detail, isFetching: loadingDetail } = useGetSupportTicketQuery(
    activeId,
    { skip: !activeId }
  );
  const [postMessage, { isLoading: sending }] = usePostSupportMessageMutation();
  const [updateStatus, { isLoading: updating }] = useUpdateSupportStatusMutation();

  const [reply, setReply] = useState("");
  async function handleReply() {
    if (!activeId || !reply.trim()) return;
    const res = await postMessage({ ticketId: activeId, body: reply.trim() });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't send reply");
      return;
    }
    setReply("");
  }

  async function handleStatus(next) {
    if (!activeId) return;
    const res = await updateStatus({ ticketId: activeId, status: next });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Couldn't update status");
      return;
    }
    toast.success(`Status set to ${next}`);
  }

  const totalUnread = tickets.reduce((s, t) => s + (t.unreadByAdmin || 0), 0);

  return (
    <div>
      <PageHeader
        title="Support tickets"
        subtitle={`${tickets.length} total · ${totalUnread} unread on your side`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Ticket list */}
        <Card className="lg:col-span-5 xl:col-span-4" bodyClassName="p-0">
          <div className="p-3 border-b border-ink-100 space-y-2">
            <div className="flex items-center bg-ink-50 border border-ink-200 rounded-lg px-3">
              <IoSearch className="text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject or user…"
                className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTab(t.v)}
                  className={cls(
                    "px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap",
                    tab === t.v
                      ? "bg-primary-50 text-primary-800"
                      : "text-ink-600 hover:bg-ink-100"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100">
            {isFetching && visible.length === 0 ? (
              <li className="px-4 py-8 text-sm text-ink-500 text-center">
                Loading…
              </li>
            ) : visible.length === 0 ? (
              <li className="px-4 py-8 text-sm text-ink-500 text-center">
                No tickets match this view.
              </li>
            ) : (
              visible.map((t) => {
                const id = t._id || t.id;
                const active = activeId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(id)}
                      className={cls(
                        "w-full text-left px-4 py-3 transition flex items-start gap-3",
                        active ? "bg-primary-50/60" : "hover:bg-ink-50/60"
                      )}
                    >
                      <img
                        src={getImageUrl(t.userId?.image)}
                        alt=""
                        className="w-9 h-9 rounded-full bg-ink-100 object-cover"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cls(
                              "text-sm truncate",
                              t.unreadByAdmin > 0
                                ? "font-bold text-ink-900"
                                : "font-medium text-ink-800"
                            )}
                          >
                            {t.subject}
                          </span>
                          <StatusPill status={STATUS_TO_PILL[t.status]} label={t.status} />
                        </div>
                        <div className="text-xs text-ink-500 truncate">
                          {t.userId?.fullName || "—"}
                          {" · "}
                          {timeAgo(t.lastMessageAt)}
                        </div>
                      </div>
                      {t.unreadByAdmin > 0 && (
                        <span className="ml-1 shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold">
                          {t.unreadByAdmin}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Card>

        {/* Thread + composer */}
        <Card className="lg:col-span-7 xl:col-span-8" bodyClassName="p-0">
          {!activeId ? (
            <div className="px-6 py-12 text-center text-sm text-ink-500">
              Pick a ticket on the left to read the conversation.
            </div>
          ) : !detail ? (
            <div className="px-6 py-12 text-center text-sm text-ink-500">
              {loadingDetail ? "Loading…" : "Couldn't load ticket."}
            </div>
          ) : (
            <ThreadView
              detail={detail}
              reply={reply}
              setReply={setReply}
              onReply={handleReply}
              onStatus={handleStatus}
              sending={sending}
              updating={updating}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function ThreadView({ detail, reply, setReply, onReply, onStatus, sending, updating }) {
  const t = detail.ticket;
  const messages = detail.messages || [];

  return (
    <>
      <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-base font-semibold text-ink-900 truncate">{t.subject}</div>
          <div className="text-xs text-ink-500">
            {t.userId?.fullName} · {t.category} · opened {formatDate(t.createdAt, { withTime: true })}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={STATUS_TO_PILL[t.status]} label={t.status} />
          {t.status !== "resolved" && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={TbCircleCheck}
              loading={updating}
              onClick={() => onStatus("resolved")}
            >
              Mark resolved
            </Button>
          )}
          {t.status !== "closed" && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={TbLock}
              loading={updating}
              onClick={() => onStatus("closed")}
            >
              Close
            </Button>
          )}
          {(t.status === "resolved" || t.status === "closed") && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={TbProgressX}
              loading={updating}
              onClick={() => onStatus("open")}
            >
              Reopen
            </Button>
          )}
        </div>
      </header>

      <div className="max-h-[55vh] overflow-y-auto px-4 py-4 space-y-3 bg-ink-50/60">
        {messages.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-4">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const fromAdmin = m.senderRole === "admin";
            return (
              <div key={m._id || m.id} className={cls("flex gap-2.5", fromAdmin && "flex-row-reverse")}>
                <img
                  src={getImageUrl(m.senderId?.image)}
                  alt=""
                  className="w-8 h-8 rounded-full bg-ink-100 object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
                <div className={cls("max-w-[80%]", fromAdmin && "items-end")}>
                  <div className={cls("flex items-center gap-2 text-xs text-ink-500 mb-1", fromAdmin && "flex-row-reverse")}>
                    <span className="font-medium text-ink-800">
                      {fromAdmin ? "You (Admin)" : m.senderId?.fullName || "Member"}
                    </span>
                    <span>·</span>
                    <span>{formatDate(m.createdAt, { withTime: true })}</span>
                  </div>
                  <div
                    className={cls(
                      "px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line",
                      fromAdmin
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-white border border-ink-200 text-ink-900 rounded-tl-sm"
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {t.status === "closed" ? (
        <div className="px-5 py-4 text-center text-sm text-ink-500 border-t border-ink-100">
          This ticket is closed. Reopen it to reply.
        </div>
      ) : (
        <div className="border-t border-ink-100 p-3 bg-white">
          <CannedPicker reply={reply} setReply={setReply} firstName={(t.userId?.fullName || "").split(" ")[0]} />
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Type a reply to the user…"
            className="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg outline-none focus:border-primary resize-none"
          />
          <div className="flex items-center justify-end mt-2">
            <Button onClick={onReply} loading={sending} iconLeft={TbSend} disabled={!reply.trim()}>
              Send reply
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// Saved replies: pick one to insert ({name} becomes the user's first
// name), save the current text as a new one, or delete the selected one.
function CannedPicker({ reply, setReply, firstName }) {
  const { data, reload } = useAdminQuery("/admin/support/canned");
  const list = data?.results || [];
  const [sel, setSel] = useState("");
  const insert = (id) => {
    setSel(id);
    const r = list.find((x) => x._id === id);
    if (!r) return;
    const text = r.body.replace(/\{name\}/g, firstName || "there");
    setReply(reply.trim() ? `${reply.trimEnd()}\n\n${text}` : text);
  };
  const save = async () => {
    const title = window.prompt("Name this canned reply");
    if (!title) return;
    try { await adminFetch("/admin/support/canned", { method: "POST", body: { title, body: reply } }); toast.success("Canned reply saved"); reload(); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async () => {
    const r = list.find((x) => x._id === sel);
    if (!r || !window.confirm(`Delete canned reply "${r.title}"?`)) return;
    try { await adminFetch(`/admin/support/canned/${r._id}`, { method: "DELETE" }); setSel(""); reload(); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <div className="flex items-center gap-2 mb-2 text-xs">
      <select aria-label="Canned reply" value={sel} onChange={(e) => insert(e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 border border-ink-200 rounded-lg bg-white">
        <option value="">Insert a canned reply…</option>
        {list.map((r) => <option key={r._id} value={r._id}>{r.title}</option>)}
      </select>
      <button type="button" className="px-2 py-1.5 rounded-lg border border-ink-200 disabled:opacity-40" disabled={!reply.trim()} onClick={save}>Save as canned</button>
      <button type="button" className="px-2 py-1.5 rounded-lg border border-ink-200 text-rose-700 disabled:opacity-40" disabled={!sel} onClick={remove}>Delete</button>
    </div>
  );
}
