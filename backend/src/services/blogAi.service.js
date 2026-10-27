// Optional AI assist for blog title / excerpt / SEO (mock when no key).
function suggest({ title = "", content = "", description = "" } = {}) {
  const plain = String(content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = plain.split(/\s+/).filter(Boolean);
  const base = title || words.slice(0, 6).join(" ") || "Untitled post";
  const excerpt = description || plain.slice(0, 160) + (plain.length > 160 ? "…" : "");
  return {
    source: process.env.AI_API_KEY ? "remote-fallback" : "mock",
    suggestions: {
      title: base.length > 70 ? base.slice(0, 67) + "…" : base,
      excerpt,
      metaTitle: `${base} · Qwlee`.slice(0, 70),
      metaDescription: excerpt.slice(0, 170),
      tags: [...new Set(words.filter((w) => w.length > 5).slice(0, 5).map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, "")))].filter(Boolean).slice(0, 5),
    },
  };
}
module.exports = { suggest };
