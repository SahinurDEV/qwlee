// Deterministic text helpers used when no AI provider is configured
// (and by tests). Same input → same output; no network.
const clean = (s, max) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const words = (s) => (clean(s, 2000).toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []);

function gigDescription({ title, skills = [] }) {
  const t = clean(title, 120) || "this service";
  const sk = (Array.isArray(skills) ? skills : String(skills).split(",")).map((x) => clean(x, 40)).filter(Boolean).slice(0, 6);
  return [
    `I will deliver ${t.toLowerCase()} that is tailored to your goals.`,
    sk.length ? `Skills I bring: ${sk.join(", ")}.` : "",
    "What you get:\n- A short kickoff to confirm scope\n- Regular progress updates\n- Clean, ready-to-use deliverables\n- Revisions until it matches the brief",
    "Message me before ordering if you have a custom request.",
  ].filter(Boolean).join("\n\n");
}

function brief({ idea }) {
  const i = clean(idea, 600);
  if (i.length < 5) return null;
  const title = i.split(/[.!?\n]/)[0].slice(0, 80);
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: `Project: ${i}\n\nGoals:\n- \n\nDeliverables:\n- \n\nTimeline and budget: \n\nPlease include examples of similar work in your offer.`,
  };
}

function replySuggestions({ message }) {
  const m = clean(message, 1000).toLowerCase();
  const out = [];
  if (/\?|can you|could you|do you/.test(m)) out.push("Yes, I can help with that. Could you share a few more details so I can confirm scope and timing?");
  if (/price|cost|budget|quote/.test(m)) out.push("Happy to send a custom offer. What budget and deadline do you have in mind?");
  if (/thank/.test(m)) out.push("You're welcome! Let me know if there's anything else you need.");
  if (/late|delay|when/.test(m)) out.push("Thanks for checking in. I'm on it and will send an update shortly.");
  out.push("Thanks for your message — I'll get back to you shortly.");
  return [...new Set(out)].slice(0, 3);
}

// Rank sellers by keyword overlap between a request and their profile.
function matchScore(text, seller) {
  const want = new Set(words(text));
  const have = words([seller.intro, seller.about, ...(seller.skills || []).map((s) => (typeof s === "string" ? s : s?.name))].join(" "));
  let hit = 0;
  for (const w of new Set(have)) if (want.has(w)) hit += 1;
  return hit + (seller.isPro ? 0.5 : 0) + (seller.online ? 0.25 : 0);
}

module.exports = { gigDescription, brief, replySuggestions, matchScore, words };
