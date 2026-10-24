"use client";
// Muted video preview over a gig card image. Desktop: plays while the
// pointer is over the card. Touch: tap the play pill to toggle.
// Nothing is loaded until the preview is opened.
import { useState } from "react";
import { IoPlay, IoClose } from "react-icons/io5";
import { embedUrl } from "@/components/Gig/GigDetails/GigFaqVideo";

const previewSrc = (v) => {
  if (!v) return null;
  if (v.kind === "video") return v;
  const sep = v.src.includes("?") ? "&" : "?";
  const yt = v.src.includes("youtube");
  const id = yt ? v.src.split("/").pop() : "";
  const extra = yt ? `autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1` : "autoplay=1&muted=1&background=1&loop=1";
  return { kind: "iframe", src: `${v.src}${sep}${extra}` };
};

export default function CardVideoPreview({ url, hovering }) {
  const [tapped, setTapped] = useState(false);
  const v = previewSrc(embedUrl(url));
  if (!v) return null;
  const on = hovering || tapped;
  return (
    <>
      {on && (
        <div className="absolute inset-0 z-[5] bg-black pointer-events-none">
          {v.kind === "video" ? (
            <video src={v.src} autoPlay muted loop playsInline preload="none" className="w-full h-full object-cover" />
          ) : (
            <iframe src={v.src} title="Gig video preview" allow="autoplay; encrypted-media" className="w-full h-full" loading="lazy" />
          )}
        </div>
      )}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTapped((t) => !t); }}
        aria-label={tapped ? "Stop video preview" : "Play video preview"}
        aria-pressed={tapped}
        className="absolute left-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white"
      >
        {tapped ? <IoClose aria-hidden /> : <IoPlay aria-hidden />} Video
      </button>
    </>
  );
}
