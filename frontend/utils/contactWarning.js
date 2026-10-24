// Spots contact details and off-platform payment talk in a message before
// it is sent, so we can warn the sender. Mirrors the server's risk rules
// (backend/src/services/risk.service.js) plus common payment words.
const RULES = [
  ["an email address", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["a phone number", /(?<![\w])(?:\+?\d[\s().-]?){9,}\d(?![\w])/],
  ["an outside messenger", /\b(whats\s?app|telegram|t\.me\/|wa\.me\/|skype|signal\s+me|discord\.gg|wechat|viber)\b/i],
  [
    "paying outside Qwlee",
    /\b(paypal|pay\s?pal|venmo|cash\s?app|zelle|western\s+union|moneygram|wise\.com|payoneer|bank\s+transfer|wire\s+transfer|bitcoin|btc|usdt|crypto|pay\s+(you\s+)?(directly|outside|off[-\s]?platform)|outside\s+(of\s+)?(qwlee|the\s+platform))\b/i,
  ],
];

export function contactWarnings(text) {
  const s = String(text || "");
  if (!s.trim()) return [];
  return RULES.filter(([, re]) => re.test(s)).map(([label]) => label);
}
