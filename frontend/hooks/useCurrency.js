"use client";
// Display currency. Prices are stored and charged in USD; this converts
// them for display with the rates from /info/currencies. The choice is
// kept in localStorage and shared across components on the page.
import { useEffect, useState } from "react";
import { baseUrl } from "@/lib/constant";

const KEY = "qwlee.currency";
const EVENT = "qwlee:currency";
let rates = null;
let inflight = null;

function loadRates() {
  if (rates) return Promise.resolve(rates);
  if (!inflight) {
    inflight = fetch(`${baseUrl}/info/currencies`, { headers: { "ngrok-skip-browser-warning": "1" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (rates = j?.data?.attributes || { base: "USD", rates: { USD: 1 } }))
      .catch(() => (rates = { base: "USD", rates: { USD: 1 } }));
  }
  return inflight;
}

export function setCurrency(code) {
  try {
    localStorage.setItem(KEY, code);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
}

export default function useCurrency() {
  const [code, setCode] = useState("USD");
  const [data, setData] = useState(rates);
  useEffect(() => {
    let alive = true;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setCode(saved);
    } catch {}
    loadRates().then((r) => alive && setData(r));
    const on = (e) => setCode(e.detail);
    window.addEventListener(EVENT, on);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, on);
    };
  }, []);
  const rate = data?.rates?.[code];
  const active = rate ? code : "USD";
  const format = (usd, { cents } = {}) => {
    const n = Number(usd || 0) * (rate || 1);
    const whole = active === "JPY" || active === "BDT" || active === "INR" ? true : !cents && Number.isInteger(Number(usd));
    return new Intl.NumberFormat(undefined, { style: "currency", currency: active, maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 }).format(n);
  };
  return { code: active, codes: Object.keys(data?.rates || { USD: 1 }), format, isUsd: active === "USD", rates: data };
}
