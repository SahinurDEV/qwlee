"use client";
// Seller-side editor for the optional Fiverr-style gig sections:
// paid extras, FAQ, buyer requirement questions and a video link.
// Controlled: `value` = { extras, faq, requirementQuestions, video }.

const input =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

function ListSection({ title, hint, items, onChange, empty, render, max }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 grid gap-2">{render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-xs text-rose-600 hover:underline mt-2"
          >
            Remove
          </button>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, empty])}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          + Add
        </button>
      )}
    </section>
  );
}

export default function GigExtrasEditor({ value, onChange }) {
  const v = {
    extras: value?.extras || [],
    faq: value?.faq || [],
    requirementQuestions: value?.requirementQuestions || [],
    video: value?.video || "",
  };
  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div className="space-y-6">
      <ListSection
        title="Gig extras"
        hint="Paid add-ons buyers can tick at checkout."
        items={v.extras}
        max={10}
        empty={{ title: "", price: "", deliveryDays: 0 }}
        onChange={(extras) => set({ extras })}
        render={(e, patch) => (
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <input className={`${input} sm:col-span-3`} placeholder="Title, e.g. Source files" value={e.title} onChange={(ev) => patch({ title: ev.target.value })} />
            <input className={`${input} sm:col-span-2`} type="number" min="0" placeholder="Price $" value={e.price} onChange={(ev) => patch({ price: ev.target.value })} />
            <input className={input} type="number" min="0" placeholder="+days" title="Extra delivery days" value={e.deliveryDays} onChange={(ev) => patch({ deliveryDays: ev.target.value })} />
          </div>
        )}
      />
      <ListSection
        title="Requirements"
        hint="Questions the buyer answers after ordering. Your delivery clock starts when they do."
        items={v.requirementQuestions}
        max={10}
        empty={{ question: "", required: true }}
        onChange={(requirementQuestions) => set({ requirementQuestions })}
        render={(q, patch) => (
          <>
            <input className={input} placeholder="Question for the buyer" value={q.question} onChange={(ev) => patch({ question: ev.target.value })} />
            <label className="text-xs text-gray-600 inline-flex items-center gap-1">
              <input type="checkbox" checked={!!q.required} onChange={(ev) => patch({ required: ev.target.checked })} className="accent-emerald-600" />
              Answer required
            </label>
          </>
        )}
      />
      <ListSection
        title="FAQ"
        items={v.faq}
        max={20}
        empty={{ question: "", answer: "" }}
        onChange={(faq) => set({ faq })}
        render={(f, patch) => (
          <>
            <input className={input} placeholder="Question" value={f.question} onChange={(ev) => patch({ question: ev.target.value })} />
            <textarea className={input} rows={2} placeholder="Answer" value={f.answer} onChange={(ev) => patch({ answer: ev.target.value })} />
          </>
        )}
      />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Video (optional)</h3>
        <input className={input} placeholder="YouTube/Vimeo link, https .mp4/.webm, or upload via gig wizard" value={v.video} onChange={(ev) => set({ video: ev.target.value })} />
      </section>
    </div>
  );
}

// Clean values for the API (drop blank rows, coerce numbers).
export function cleanGigExtras(v) {
  return {
    extras: (v?.extras || [])
      .filter((e) => String(e.title || "").trim())
      .map((e) => ({ ...(e._id ? { _id: e._id } : {}), title: e.title.trim(), price: Number(e.price) || 0, deliveryDays: Number(e.deliveryDays) || 0 })),
    faq: (v?.faq || []).filter((f) => String(f.question || "").trim()),
    requirementQuestions: (v?.requirementQuestions || []).filter((q) => String(q.question || "").trim()),
    video: String(v?.video || "").trim(),
  };
}
