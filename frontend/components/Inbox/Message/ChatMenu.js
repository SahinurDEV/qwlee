"use client";
// Conversation "⋮" menu: search, pin, archive, block and report.
import { useEffect, useRef, useState } from "react";
import { IoEllipsisVertical } from "react-icons/io5";

export default function ChatMenu({ pinned, archived, blockedByMe, onAction, onSearch, onReport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = (label, fn, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        fn();
      }}
      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${danger ? "text-rose-600" : "text-gray-800"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
        aria-label="Conversation options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IoEllipsisVertical className="text-xl" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 max-w-[80vw] bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30"
        >
          {item("Search in conversation", onSearch)}
          {item(pinned ? "Unpin conversation" : "Pin conversation", () => onAction(pinned ? "unpin" : "pin"))}
          {item(archived ? "Move to inbox" : "Archive conversation", () => onAction(archived ? "unarchive" : "archive"))}
          <div className="my-1 border-t border-gray-100" />
          {item(blockedByMe ? "Unblock" : "Block", () => onAction(blockedByMe ? "unblock" : "block"), !blockedByMe)}
          {item("Report", onReport, true)}
        </div>
      )}
    </div>
  );
}
