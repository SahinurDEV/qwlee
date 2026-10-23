"use client";
// Lightweight emoji picker — no extra dependency.
//
// Six categories of common emojis. Click outside / press Escape to
// close. `onPick(emoji)` fires with the literal glyph; the caller is
// responsible for inserting it at the textarea caret.

import { useEffect, useMemo, useRef, useState } from "react";

const CATEGORIES = [
  {
    name: "Smileys",
    icon: "😀",
    items: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","😊","🙂",
      "🙃","😉","😍","😘","😗","😙","😚","🤗","🤔","🤩",
      "😎","🥰","😇","😋","😜","😝","😏","🥲","😴","🤤",
      "😭","😢","😅","😩","😤","🤯","😱","😨","😰","😥",
      "😡","🤬","🤒","🤧","🤐","🙄","😬","😶","😐","😑",
    ],
  },
  {
    name: "Gestures",
    icon: "👍",
    items: [
      "👍","👎","👏","🙌","🙏","👌","✌️","🤞","🤝","💪",
      "🫶","🤟","🤘","✋","🖐️","🖖","👋","🤙","☝️","👇",
      "👆","👈","👉","🫡","🫰","🫵","🙇","💁","🙆","🙅",
    ],
  },
  {
    name: "Hearts",
    icon: "❤️",
    items: [
      "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💗",
      "💖","💘","💝","💞","💕","💓","💟","❣️","💔","♥️",
    ],
  },
  {
    name: "Objects",
    icon: "💻",
    items: [
      "💻","📱","⌨️","🖱️","🖥️","🖨️","📷","🎥","📸","📺",
      "🎨","🖌️","✏️","📝","📌","📎","🗂️","📁","📂","🗃️",
      "💼","📦","📧","📨","📅","🗓️","⏰","⏱️","💡","🔧",
    ],
  },
  {
    name: "Symbols",
    icon: "✅",
    items: [
      "✅","❌","⚠️","❗","❓","💯","🔥","✨","⭐","🌟",
      "💫","💥","🎉","🎊","🎁","🎈","🏆","🥇","🥈","🥉",
      "🔔","🔕","🔒","🔓","🔑","🚀","📈","📉","💰","💵",
    ],
  },
  {
    name: "Food",
    icon: "🍕",
    items: [
      "🍕","🍔","🍟","🌭","🍿","🌮","🌯","🥙","🥪","🍣",
      "🍜","🍝","🍱","🍙","🍘","🍩","🍪","🎂","🍰","🧁",
      "🍦","🍫","🍬","☕","🍵","🧋","🍺","🍷","🥂","🥤",
    ],
  },
];

export default function EmojiPicker({ open, onClose, onPick, anchorClassName = "" }) {
  const [tab, setTab] = useState(0);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) onClose?.();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const active = useMemo(() => CATEGORIES[tab] || CATEGORIES[0], [tab]);

  if (!open) return null;
  return (
    <div
      ref={rootRef}
      className={`absolute bottom-full mb-2 z-30 w-[300px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden ${anchorClassName}`}
    >
      <div className="flex border-b border-gray-100">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setTab(i)}
            className={`flex-1 py-1.5 text-base transition ${
              i === tab ? "bg-emerald-50" : "hover:bg-gray-50"
            }`}
            title={c.name}
            aria-label={c.name}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="px-2 py-1 text-xs uppercase tracking-wide text-gray-400 font-semibold">
        {active.name}
      </div>
      <div className="grid grid-cols-8 gap-0.5 px-1.5 pb-2 max-h-[200px] overflow-y-auto">
        {active.items.map((emoji, i) => (
          <button
            key={`${tab}-${i}-${emoji}`}
            type="button"
            onClick={() => onPick?.(emoji)}
            className="text-xl h-8 w-8 rounded-md hover:bg-gray-100 transition"
            aria-label={`Insert ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
