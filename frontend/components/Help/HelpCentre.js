"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useGetAllBlogsQuery } from "@/app/redux/features/getAllBlogs";
import { IoSearchOutline, IoChevronForward } from "react-icons/io5";
import { useGetHelpQuery } from "@/app/redux/features/helpApi";

export default function HelpCentre() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);
  const { data, isFetching } = useGetHelpQuery({ q, category });
  const results = data?.results || [];
  const { data: all } = useGetHelpQuery({});
  const categories = all?.categories || [];
  const grouped = results.reduce((m, a) => ((m[a.category] = m[a.category] || []).push(a), m), {});

  return (
    <main className="bg-gray-50/40 min-h-screen">
      <section className="bg-emerald-700 text-white">
        <div className="container mx-auto px-4 py-12 max-w-3xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold">How can we help?</h1>
          <label className="relative block mt-6">
            <span className="sr-only">Search help articles</span>
            <IoSearchOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search for answers, e.g. refund, withdraw, two-factor"
              className="w-full rounded-xl pl-12 pr-4 py-3 text-gray-900 outline-none"
            />
          </label>
        </div>
      </section>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Help topics">
          {[{ name: "", label: "All topics" }, ...categories.map((c) => ({ name: c.name, label: `${c.name}` }))].map((c) => (
            <button
              key={c.name || "all"}
              type="button"
              role="tab"
              aria-selected={category === c.name}
              onClick={() => setCategory(c.name)}
              className={`text-sm px-3 py-1.5 rounded-full border ${category === c.name ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {!isFetching && results.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-700">No articles match &ldquo;{q}&rdquo;.</p>
            <Link href="/support" className="inline-block mt-3 text-emerald-700 font-medium">Contact support</Link>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{cat}</h2>
              <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link href={`/help/${a.slug}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50">
                      <span>
                        <span className="block font-medium text-gray-900">{a.title}</span>
                        <span className="block text-sm text-gray-500 line-clamp-1">{a.excerpt}</span>
                      </span>
                      <IoChevronForward className="text-gray-400 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        <HelpGuides />
        <p className="text-sm text-gray-500 text-center mt-8">
          Still need help? <Link href="/support" className="text-emerald-700 font-medium">Contact support</Link>
        </p>
      </div>
    </main>
  );
}

// Latest step-by-step guides from the blog (posts marked "guide").
function HelpGuides() {
  const { data } = useGetAllBlogsQuery("guide");
  const guides = (data?.data?.attributes?.results || []).slice(0, 4);
  if (!guides.length) return null;
  return (
    <section className="mt-8" aria-labelledby="help-guides">
      <div className="flex items-end justify-between mb-2">
        <h2 id="help-guides" className="text-lg font-semibold text-gray-900">Guides</h2>
        <Link href="/blogs?kind=guide" className="text-sm text-emerald-700 font-medium">All guides →</Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {guides.map((g) => (
          <li key={g.id || g._id}>
            <Link href={`/blogs/${g.slug}`} className="block h-full bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-emerald-300">
              <span className="block font-medium text-gray-900 line-clamp-2">{g.title}</span>
              <span className="block mt-1 text-sm text-gray-500 line-clamp-2">{String(g.description || "").replace(/<[^>]+>/g, " ").trim()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
