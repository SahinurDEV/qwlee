"use client";
// Admin-controlled strip shown above the top navigation.
import { useEffect, useState } from "react";
import Link from "next/link";
import { IoClose, IoMegaphoneOutline } from "react-icons/io5";
import useSiteConfig from "@/hooks/useSiteConfig";

const TONES = {
  info: "bg-gray-900 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-400 text-gray-900",
};

export default function AnnouncementBar() {
  const cfg = useSiteConfig();
  const a = cfg?.homepage?.announcement;
  const key = a?.text ? `qwlee:announcement:${a.text}` : null;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (key) setHidden(sessionStorage.getItem(key) === "1");
  }, [key]);
  if (!a?.enabled || !a.text || hidden) return null;
  const inner = (
    <span className="inline-flex items-center gap-2">
      <IoMegaphoneOutline className="shrink-0" />
      {a.text}
      {a.link ? <span className="underline underline-offset-2 font-semibold">Learn more</span> : null}
    </span>
  );
  return (
    <div className={`relative px-10 py-2 text-center text-xs md:text-sm font-medium ${TONES[a.tone] || TONES.info}`} role="status" data-testid="announcement-bar">
      {a.link ? (a.link.startsWith("/") ? <Link href={a.link}>{inner}</Link> : <a href={a.link} target="_blank" rel="noopener noreferrer">{inner}</a>) : inner}
      <button type="button" aria-label="Dismiss" onClick={() => { sessionStorage.setItem(key, "1"); setHidden(true); }} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100">
        <IoClose />
      </button>
    </div>
  );
}
