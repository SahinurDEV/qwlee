"use client";
// Gig video (YouTube / Vimeo / direct file) and FAQ accordion.

const embedUrl = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (/youtu\.be$/.test(u.hostname)) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    if (/youtube\.com$/.test(u.hostname)) {
      const id = u.searchParams.get("v") || u.pathname.split("/").pop();
      return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (/vimeo\.com$/.test(u.hostname)) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
    }
    if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: "video", src: url };
  } catch (_) {}
  return null;
};

export function GigVideo({ url, title }) {
  const v = embedUrl(url);
  if (!v) return null;
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="aspect-video bg-black">
        {v.kind === "iframe" ? (
          <iframe
            src={v.src}
            title={title ? `${title} video` : "Gig video"}
            className="w-full h-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <video src={v.src} controls className="w-full h-full" preload="metadata" />
        )}
      </div>
    </section>
  );
}

export function GigFaq({ faq }) {
  const items = Array.isArray(faq) ? faq.filter((f) => f?.question) : [];
  if (items.length === 0) return null;
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7">
      <h2 className="text-lg md:text-xl font-semibold text-gray-900">FAQ</h2>
      <div className="mt-3 divide-y divide-gray-100">
        {items.map((f, i) => (
          <details key={i} className="group py-3">
            <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-medium text-gray-900">
              {f.question}
              <span className="ml-3 text-gray-400 group-open:rotate-45 transition">+</span>
            </summary>
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
