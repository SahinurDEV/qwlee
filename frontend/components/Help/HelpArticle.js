"use client";
import { useState } from "react";
import Link from "next/link";
import { IoArrowBack } from "react-icons/io5";
import { useGetHelpArticleQuery, useHelpFeedbackMutation } from "@/app/redux/features/helpApi";
import ArticleBody from "./ArticleBody";

export default function HelpArticle({ slug }) {
  const { data: a, isLoading, isError } = useGetHelpArticleQuery(slug);
  const [send] = useHelpFeedbackMutation();
  const [voted, setVoted] = useState(null);
  const vote = async (helpful) => {
    setVoted(helpful);
    await send({ slug, helpful });
  };
  return (
    <main className="container mx-auto px-4 py-8 md:py-10 max-w-3xl">
      <Link href="/help" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <IoArrowBack aria-hidden /> Help centre
      </Link>
      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : isError || !a ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-800">This article doesn&apos;t exist or was removed.</p>
        </div>
      ) : (
        <article className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
          <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">{a.category}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 mb-5">{a.title}</h1>
          <ArticleBody text={a.body} />
          <div className="mt-8 pt-5 border-t border-gray-100">
            {voted === null ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-700">Was this helpful?</span>
                <button type="button" onClick={() => vote(true)} className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Yes</button>
                <button type="button" onClick={() => vote(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">No</button>
              </div>
            ) : (
              <p className="text-sm text-gray-700" role="status">
                Thanks for letting us know.{voted === false ? <> <Link href="/support" className="text-emerald-700 font-medium">Contact support</Link> if you still need help.</> : null}
              </p>
            )}
          </div>
          {a.related?.length ? (
            <div className="mt-8">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Related articles</h2>
              <ul className="space-y-1">
                {a.related.map((r) => (
                  <li key={r.id}><Link href={`/help/${r.slug}`} className="text-emerald-700 hover:underline text-sm">{r.title}</Link></li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      )}
    </main>
  );
}
