"use client";
// Small dependency-free SVG chart: area + line, y gridlines, thinned x
// labels and a tap/hover readout. Scales to its container width.
import { useMemo, useState } from "react";

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

export default function TrendChart({ points, format = (v) => v, label }) {
  const [active, setActive] = useState(null);
  const W = 600, H = 220, L = 44, R = 8, T = 10, B = 26;
  const { max, xs, ys, path, area } = useMemo(() => {
    const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
    const n = points.length;
    const xs = points.map((_, i) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)));
    const ys = points.map((p) => T + (H - T - B) * (1 - p.value / max));
    const path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    const area = n ? `${path} L${xs[n - 1].toFixed(1)},${H - B} L${xs[0].toFixed(1)},${H - B} Z` : "";
    return { max, xs, ys, path, area };
  }, [points]);
  if (!points.length) return null;
  const step = Math.max(1, Math.ceil(points.length / 6));
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
    setActive(best);
  };
  const a = active != null ? points[active] : null;
  return (
    <div className="relative">
      <div className="h-5 text-xs text-gray-600" aria-live="polite">
        {a ? <><span className="font-semibold text-gray-900">{format(a.value)}</span> · {a.label}{a.note ? ` · ${a.note}` : ""}</> : <span className="text-gray-400">Tap or hover the chart for details</span>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none"
        role="img"
        aria-label={`${label}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = T + (H - T - B) * (1 - f);
          return (
            <g key={f}>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="#f1f5f9" />
              <text x={L - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{format(max * f)}</text>
            </g>
          );
        })}
        <path d={area} fill="#10b981" fillOpacity="0.12" />
        <path d={path} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (i % step === 0 || i === points.length - 1) && (
          <text key={p.label} x={xs[i]} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">{p.short || p.label}</text>
        ))}
        {a && (
          <g>
            <line x1={xs[active]} x2={xs[active]} y1={T} y2={H - B} stroke="#cbd5e1" strokeDasharray="3 3" />
            <circle cx={xs[active]} cy={ys[active]} r="4" fill="#059669" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}
