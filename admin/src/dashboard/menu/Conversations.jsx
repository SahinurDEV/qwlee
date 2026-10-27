// /dashboard/conversations — admin read-only chat review.
//
// Tabbed: "Direct messages" (Chat + Message collections) and "Order
// chats" (orderMessage scoped to a Payment._id). Picking a row on the
// left renders the full thread on the right. No composer — moderation
// is observation-only.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { frontendUrl } from "../../baseUrl";
import { Modal as RModal } from "react-responsive-modal";
import { IoSearch, IoImageOutline } from "react-icons/io5";

import {
  useGetDirectChatsQuery,
  useGetDirectChatMessagesQuery,
  useGetOrderChatsQuery,
  useGetOrderChatMessagesQuery,
  useGetFlaggedChatsQuery,
} from "../../redux/api/apiSlice";
import { adminFetch } from "../../utils/adminApi";
import toast from "react-hot-toast";
import Button from "../../common/Button";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import StatusPill from "../../common/StatusPill";
import cls from "../../utils/cls";
import { formatDate as _formatDate, timeAgo, truncate } from "../../utils/format";
const formatDate = _formatDate;
import getImageUrl from "../../utils/getImageUrl";

import "react-responsive-modal/styles.css";

const TABS = [
  { v: "direct", label: "Direct messages" },
  { v: "order", label: "Order chats" },
  { v: "flagged", label: "Flagged" },
];

const REASON_LABEL = (r) =>
  r.startsWith("keyword:") ? `Word “${r.slice(8)}”` :
  ({
    "contact:email": "Email",
    "contact:phone": "Phone",
    "contact:messenger": "Messenger",
    "contact:social": "Social handle",
    "contact:payment": "Payment details",
    "contact:card": "Card number",
    "contact:offplatform": "Off-platform ask",
    "contact:obfuscated-email": "Obfuscated email",
    "contact:obfuscated-phone": "Obfuscated phone",
  })[r] || r;

function previewOf(msg) {
  const c = msg?.content || {};
  if (c.messageType === "text" && c.message) return truncate(c.message, 60);
  if (c.messageType === "image") return "Sent a photo";
  if (c.messageType === "offer") return "Sent a custom offer";
  if (c.messageType === "deliveryMessage") return "Delivery";
  if (c.gigReference) return "Sent a gig reference";
  if (Array.isArray(c.files) && c.files.length) return "Sent an attachment";
  return "(no preview)";
}

export default function Conversations() {
  // Deep links: ?chat=<chatId> or ?a=<userId>&b=<userId> open a direct
  // conversation; ?tab=order&order=<orderId> opens an order chat.
  const [params] = useSearchParams();
  const initialTab = ["order", "flagged"].includes(params.get("tab")) ? params.get("tab") : "direct";
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");

  return (
    <div>
      <PageHeader
        title="Conversations"
        subtitle="Live moderation inbox — DMs, order chats, and AI/heuristic flags for off-platform contact sharing."
      />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex gap-1 bg-white border border-ink-200 rounded-lg p-0.5">
          {TABS.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={cls(
                "px-3 py-1.5 text-xs font-medium rounded-md transition",
                tab === t.v
                  ? "bg-primary-50 text-primary-800"
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-white border border-ink-200 rounded-lg px-3 w-full max-w-sm focus-within:border-primary">
          <IoSearch className="text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "direct"
                ? "Search by name or email…"
                : "Search by buyer, seller, or gig title…"
            }
            className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
          />
        </div>
      </div>

      {tab === "direct" ? (
        <DirectMessages search={search} initialChat={params.get("chat")} pair={[params.get("a"), params.get("b")]} />
      ) : tab === "order" ? (
        <OrderChats search={search} initialOrder={params.get("order")} />
      ) : (
        <FlaggedQueue initialChat={params.get("chat")} />
      )}
    </div>
  );
}

function DirectMessages({ search, initialChat, pair = [] }) {
  const { data, isFetching } = useGetDirectChatsQuery({ search });
  const rows = data?.results || data?.attributes?.results || [];
  const [activeId, setActiveId] = useState(initialChat || null);
  useEffect(() => {
    if (activeId || !pair[0] || !pair[1] || !rows.length) return;
    const ids = (r) => (r.chat.participants || []).map((p) => String(p._id || p.id || p));
    const hit = rows.find((r) => ids(r).includes(String(pair[0])) && ids(r).includes(String(pair[1])));
    if (hit) setActiveId(hit.chat._id || hit.chat.id);
  }, [rows, pair[0], pair[1], activeId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-5 xl:col-span-4" bodyClassName="p-0">
        <ul className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100">
          {isFetching && rows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-ink-500 text-center">Loading…</li>
          ) : rows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-ink-500 text-center">
              No conversations match this view.
            </li>
          ) : (
            rows.map((row) => {
              const id = row.chat._id || row.chat.id;
              const p = row.chat.participants || [];
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(id)}
                    className={cls(
                      "w-full text-left px-4 py-3 flex items-start gap-3 transition",
                      activeId === id ? "bg-primary-50/60" : "hover:bg-ink-50/60"
                    )}
                  >
                    <Avatars users={p} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900 truncate">
                        {p.map((x) => x.fullName).filter(Boolean).join(" ↔ ") || "Conversation"}
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {previewOf(row.lastMessage)}
                      </div>
                      {row.flagged ? (
                        <span className="inline-flex mt-1 items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5">
                          {row.openFlags} flagged
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink-400 whitespace-nowrap text-right">
                      {row.lastMessage?.createdAt
                        ? timeAgo(row.lastMessage.createdAt)
                        : ""}
                      <div className="text-ink-400">{row.messageCount} msgs</div>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Card>
      <Card className="lg:col-span-7 xl:col-span-8" bodyClassName="p-0">
        {!activeId ? (
          <div className="px-6 py-12 text-center text-sm text-ink-500">
            Pick a conversation to read the full thread.
          </div>
        ) : (
          <DirectThread chatId={activeId} />
        )}
      </Card>
    </div>
  );
}

function DirectThread({ chatId }) {
  const { data, isFetching } = useGetDirectChatMessagesQuery(chatId);
  const [zoom, setZoom] = useState(null);
  if (isFetching && !data) {
    return (
      <div className="px-6 py-12 text-center text-sm text-ink-500">Loading…</div>
    );
  }
  if (!data) return null;
  const { chat, messages } = data;
  const participants = chat?.participants || [];
  return (
    <>
      <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Avatars users={participants} />
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink-900 truncate">
              {participants.map((p) => p.fullName).filter(Boolean).join(" ↔ ")}
            </div>
            <div className="text-xs text-ink-500 truncate">
              {participants.map((p) => p.email).filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="text-xs text-ink-500">{messages.length} messages</div>
      </header>
      <ThreadBody messages={messages} kind="direct" onZoom={setZoom} />
      <ZoomModal url={zoom} onClose={() => setZoom(null)} />
    </>
  );
}

function OrderChats({ search, initialOrder }) {
  const { data, isFetching } = useGetOrderChatsQuery({ search });
  const rows = data?.results || [];
  const [activeId, setActiveId] = useState(initialOrder || null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-5 xl:col-span-4" bodyClassName="p-0">
        <ul className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100">
          {isFetching && rows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-ink-500 text-center">Loading…</li>
          ) : rows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-ink-500 text-center">
              No order chats match this view.
            </li>
          ) : (
            rows.map((row) => {
              const id = row.orderId;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(id)}
                    className={cls(
                      "w-full text-left px-4 py-3 flex items-start gap-3 transition",
                      activeId === id ? "bg-primary-50/60" : "hover:bg-ink-50/60"
                    )}
                  >
                    <div className="w-12 h-9 rounded-md overflow-hidden bg-ink-100 shrink-0">
                      {row.order?.gigId?.images?.[0] && (
                        <img
                          src={getImageUrl(row.order.gigId.images[0])}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900 truncate">
                        {row.order?.gigId?.title || row.order?.data?.title || "Order"}
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {row.order?.clientId?.fullName || "—"} ↔{" "}
                        {row.order?.freelancerId?.fullName || "—"}
                      </div>
                    </div>
                    <div className="text-xs text-ink-400 whitespace-nowrap text-right">
                      {row.lastMessage?.createdAt ? timeAgo(row.lastMessage.createdAt) : ""}
                      <div>{row.messageCount} msgs</div>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Card>
      <Card className="lg:col-span-7 xl:col-span-8" bodyClassName="p-0">
        {!activeId ? (
          <div className="px-6 py-12 text-center text-sm text-ink-500">
            Pick an order on the left to read its chat.
          </div>
        ) : (
          <OrderThread orderId={activeId} />
        )}
      </Card>
    </div>
  );
}

function OrderThread({ orderId }) {
  const { data, isFetching } = useGetOrderChatMessagesQuery(orderId);
  const [zoom, setZoom] = useState(null);
  if (isFetching && !data) {
    return (
      <div className="px-6 py-12 text-center text-sm text-ink-500">Loading…</div>
    );
  }
  if (!data) return null;
  const { order, messages } = data;
  return (
    <>
      <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-9 rounded-md overflow-hidden bg-ink-100 shrink-0">
            {order?.gigId?.images?.[0] && (
              <img
                src={getImageUrl(order.gigId.images[0])}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink-900 truncate">
              {order?.gigId?.title || order?.data?.title || "Order"}
            </div>
            <div className="text-xs text-ink-500 truncate">
              #{String(orderId).slice(-8).toUpperCase()} ·{" "}
              {order?.clientId?.fullName} ↔ {order?.freelancerId?.fullName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={(order?.status || "active").toLowerCase()} />
          <a
            href={`${frontendUrl}/order/${orderId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary-700 hover:text-primary-800"
          >
            Open order →
          </a>
        </div>
      </header>
      <ThreadBody messages={messages} kind="order" onZoom={setZoom} />
      <ZoomModal url={zoom} onClose={() => setZoom(null)} />
    </>
  );
}

function ThreadBody({ messages, kind, onZoom }) {
  if (!messages?.length) {
    return (
      <div className="px-6 py-12 text-center text-sm text-ink-500">
        No messages in this thread.
      </div>
    );
  }
  return (
    <div className="bg-ink-50/60 px-4 py-5 max-h-[60vh] overflow-y-auto space-y-3">
      {messages.map((m) => {
        const c = m.content || {};
        const sender = m.sender || {};
        return (
          <div key={m._id || m.id} className="flex gap-2.5">
            <img
              src={getImageUrl(sender.image)}
              alt=""
              className="w-8 h-8 rounded-full bg-ink-100 object-cover"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <span className="font-medium text-ink-800">{sender.fullName || "—"}</span>
                <span>·</span>
                <span>{formatDate(m.createdAt, { withTime: true })}</span>
                {kind === "direct" && sender.role && (
                  <span className="text-ink-400 capitalize">· {sender.role}</span>
                )}
              </div>
              {c.messageType === "offer" ? (
                <OfferBlock c={c} />
              ) : (
                <div className="mt-1 px-3.5 py-2 rounded-2xl bg-white border border-ink-200 text-sm text-ink-900 max-w-[80%] whitespace-pre-line">
                  {c.message || (c.deliveryDetails?.message ? c.deliveryDetails.message : "")}
                  {c.gigReference?.title && (
                    <div className="mt-2 text-xs text-ink-500 italic">
                      ↳ Gig reference: {c.gigReference.title}
                    </div>
                  )}
                  {Array.isArray(c.files) && c.files.length > 0 && (
                    <FilesGrid files={c.files} onZoom={onZoom} />
                  )}
                  {Array.isArray(c.deliveryDetails?.files) &&
                    c.deliveryDetails.files.length > 0 && (
                      <FilesGrid files={c.deliveryDetails.files} onZoom={onZoom} />
                    )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfferBlock({ c }) {
  const o = c.offerDetails || {};
  return (
    <div className="mt-1 max-w-[80%] rounded-2xl border border-ink-200 bg-white overflow-hidden">
      <div className="px-3.5 py-2 border-b border-ink-100 text-sm font-semibold text-ink-900 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-primary-700">Custom offer</span>
        <span className="text-ink-300">·</span>
        <span className="truncate">{o.gigTitle || "—"}</span>
        <span className="ml-auto text-ink-900">${o.price || 0}</span>
      </div>
      <div className="px-3.5 py-2 text-sm text-ink-700 whitespace-pre-line">
        {o.description || ""}
      </div>
      <div className="px-3.5 py-2 text-xs text-ink-500 flex items-center gap-3 border-t border-ink-100">
        <span>Delivery: {o.deliveryTime || "—"} days</span>
        <span>Revisions: {o.revisionDays || "—"}</span>
        <span className="ml-auto capitalize text-ink-700">Status: {o.status || "pending"}</span>
      </div>
    </div>
  );
}

function FilesGrid({ files, onZoom }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {files.map((f, i) => {
        const url = getImageUrl(f?.path) || f?.path;
        const isImage = f?.fileType === "image" || /\.(png|jpe?g|webp|gif|avif)$/i.test(f?.path || "");
        if (isImage && url) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onZoom?.(url)}
              className="block aspect-square rounded-md overflow-hidden border border-ink-200 group"
            >
              <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
            </button>
          );
        }
        return (
          <a
            key={i}
            href={url || "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center aspect-square rounded-md border border-ink-200 text-xs text-ink-500 hover:bg-ink-50"
          >
            <IoImageOutline className="w-4 h-4 mr-1" />
            FILE
          </a>
        );
      })}
    </div>
  );
}

function Avatars({ users }) {
  const list = (users || []).slice(0, 2);
  return (
    <div className="flex -space-x-2 shrink-0">
      {list.map((u, i) => (
        <img
          key={u._id || u.id || i}
          src={getImageUrl(u.image)}
          alt=""
          className="w-9 h-9 rounded-full ring-2 ring-white bg-ink-100 object-cover"
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
      ))}
    </div>
  );
}


function FlaggedQueue({ initialChat }) {
  const [status, setStatus] = useState("open");
  const { data, isFetching, refetch } = useGetFlaggedChatsQuery({ status });
  const rows = data?.results || data?.attributes?.results || [];
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (!rows.length) return;
    if (initialChat) {
      const hit = rows.find((f) => String(f.chatId?._id || f.chatId) === String(initialChat));
      if (hit) setActive(hit);
    }
  }, [rows, initialChat]);

  async function act(flag, next, label) {
    try {
      await adminFetch(`/admin/risk-flags/${flag.id || flag._id}`, { method: "PATCH", body: { status: next, reason: label } });
      toast.success(label);
      refetch();
      setActive(null);
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" data-testid="flagged-queue">
      <Card className="lg:col-span-5 xl:col-span-4" bodyClassName="p-0" title="Flagged messages">
        <div className="px-3 py-2 border-b border-ink-100 flex gap-1">
          {["open", "actioned", "dismissed", "all"].map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cls("px-2 py-1 text-xs rounded-md capitalize", status === s ? "bg-amber-100 text-amber-900" : "text-ink-600 hover:bg-ink-50")}>{s}</button>
          ))}
        </div>
        <ul className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100">
          {isFetching && !rows.length ? (
            <li className="px-4 py-8 text-sm text-ink-500 text-center">Loading…</li>
          ) : !rows.length ? (
            <li className="px-4 py-8 text-sm text-ink-500 text-center">No flagged messages.</li>
          ) : rows.map((f) => (
            <li key={f.id || f._id}>
              <button type="button" onClick={() => setActive(f)} className={cls("w-full text-left px-4 py-3 hover:bg-ink-50/60", (active?.id || active?._id) === (f.id || f._id) ? "bg-amber-50" : "")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-ink-900 truncate">{f.userId?.fullName || "Unknown user"}</div>
                  <span className="text-[10px] font-semibold rounded-full bg-ink-900 text-white px-1.5 py-0.5">score {f.score || f.reasons?.length || 1}</span>
                </div>
                <div className="text-xs text-ink-600 mt-0.5 line-clamp-2">{f.excerpt}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(f.reasons || []).slice(0, 4).map((r) => (
                    <span key={r} className="text-[10px] rounded bg-amber-100 text-amber-900 px-1.5 py-0.5">{REASON_LABEL(r)}</span>
                  ))}
                </div>
                <div className="text-[11px] text-ink-400 mt-1">{f.createdAt ? timeAgo(f.createdAt) : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="lg:col-span-7 xl:col-span-8" bodyClassName="p-0">
        {!active ? (
          <div className="px-6 py-12 text-center text-sm text-ink-500">Pick a flagged message to review evidence and take action.</div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <div className="text-lg font-semibold text-ink-900">Risk review</div>
              <div className="text-sm text-ink-600">AI/heuristic scan · source {active.aiSource || "heuristic"}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">Excerpt</div>
              <div className="text-sm text-ink-900 whitespace-pre-wrap">{active.excerpt}</div>
              {active.spans?.length ? (
                <div className="mt-2 text-xs text-ink-600">Highlighted: {active.spans.map((s) => s.text).filter(Boolean).join(" · ")}</div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(active.reasons || []).map((r) => (
                <span key={r} className="text-xs rounded-full bg-white border border-ink-200 px-2 py-1">{REASON_LABEL(r)}</span>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-ink-100 p-3">
                <div className="text-xs text-ink-500">User</div>
                <div className="font-medium">{active.userId?.fullName || "—"}</div>
                <div className="text-xs text-ink-500">{active.userId?.email}</div>
              </div>
              <div className="rounded-lg border border-ink-100 p-3">
                <div className="text-xs text-ink-500">Chat</div>
                <div className="font-medium truncate">
                  {(active.chatId?.participants || []).map((p) => p.fullName).filter(Boolean).join(" ↔ ") || String(active.chatId?._id || active.chatId || "—")}
                </div>
                {active.chatId?._id || active.chatId ? (
                  <a className="text-xs text-primary-700 underline" href={`?tab=direct&chat=${active.chatId._id || active.chatId}`}>Open conversation</a>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-ink-100">
              <Button size="sm" variant="secondary" onClick={() => act(active, "dismissed", "Dismissed")}>Dismiss</Button>
              <Button size="sm" onClick={() => act(active, "actioned", "Marked actioned")}>Mark actioned</Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                const uid = active.userId?.id || active.userId?._id || active.userId;
                if (!uid) return toast.error("No user on this flag");
                try {
                  await adminFetch(`/admin/users/${uid}/warnings`, { method: "POST", body: { reason: "off_platform", note: "Contact sharing in chat", source: "conversation-flag" } });
                  await act(active, "actioned", "Warned user");
                } catch (e) { toast.error(e.message); }
              }}>Warn user</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ZoomModal({ url, onClose }) {
  return (
    <RModal
      open={!!url}
      onClose={onClose}
      center
      classNames={{ modal: "rounded-2xl !p-0 !m-0 bg-transparent shadow-none", overlay: "bg-black/70" }}
    >
      {url && (
        <img
          src={url}
          alt="Attachment"
          className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-lg"
        />
      )}
    </RModal>
  );
}
