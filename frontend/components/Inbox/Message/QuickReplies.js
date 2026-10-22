"use client";
// Saved snippets for the chat composer: pick one to insert it, or
// add / edit / delete your own.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IoFlashOutline, IoTrashOutline, IoCreateOutline } from "react-icons/io5";
import { useGetQuickRepliesQuery, useSaveQuickReplyMutation, useDeleteQuickReplyMutation } from "@/app/redux/features/quickRepliesApi";

export default function QuickReplies({ onPick }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // {id?, title, body}
  const ref = useRef(null);
  const { data = [] } = useGetQuickRepliesQuery(undefined, { skip: !open });
  const [save, { isLoading: saving }] = useSaveQuickReplyMutation();
  const [remove] = useDeleteQuickReplyMutation();

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setEditing(null); } };
    const esc = (e) => { if (e.key === "Escape") { setOpen(false); setEditing(null); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const submit = async () => {
    const r = await save(editing);
    if (r.error) return toast.error(r.error?.data?.message || "Could not save");
    setEditing(null);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Quick replies" aria-expanded={open} title="Quick replies">
        <IoFlashOutline className="text-lg" />
      </button>
      {open ? (
        <div className="absolute bottom-10 left-0 z-30 w-80 rounded-xl border border-gray-200 bg-white shadow-lg p-3">
          {editing ? (
            <div className="space-y-2">
              <label className="block text-xs text-gray-600" htmlFor="qr-title">Title</label>
              <input id="qr-title" maxLength={60} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <label className="block text-xs text-gray-600" htmlFor="qr-body">Message</label>
              <textarea id="qr-body" rows={4} maxLength={2000} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <div className="flex gap-2">
                <button type="button" disabled={saving || !editing.title.trim() || !editing.body.trim()} onClick={submit} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm">Back</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">Quick replies</p>
                <button type="button" onClick={() => setEditing({ title: "", body: "" })} className="text-xs text-emerald-700 hover:underline">+ New</button>
              </div>
              {data.length === 0 ? <p className="text-xs text-gray-500 py-2">Save answers you send often and insert them with one click.</p> : (
                <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                  {data.map((q) => (
                    <li key={q.id} className="flex items-start gap-2 py-2">
                      <button type="button" className="flex-1 text-left min-w-0" onClick={() => { onPick(q.body); setOpen(false); }}>
                        <span className="block text-sm font-medium text-gray-900 truncate">{q.title}</span>
                        <span className="block text-xs text-gray-500 truncate">{q.body}</span>
                      </button>
                      <button type="button" aria-label={`Edit ${q.title}`} onClick={() => setEditing(q)} className="p-1 text-gray-500 hover:text-gray-800"><IoCreateOutline /></button>
                      <button type="button" aria-label={`Delete ${q.title}`} onClick={() => remove(q.id)} className="p-1 text-gray-500 hover:text-rose-600"><IoTrashOutline /></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
