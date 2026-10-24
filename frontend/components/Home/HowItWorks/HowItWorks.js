"use client";
// "How it works" with a buyer / seller switch.
import { useI18n } from "@/components/Context/I18nProvider";
import { useState } from "react";
import Link from "next/link";
import {
  IoSearchOutline,
  IoChatbubblesOutline,
  IoShieldCheckmarkOutline,
  IoCheckmarkDoneOutline,
  IoPersonAddOutline,
  IoBriefcaseOutline,
  IoRocketOutline,
  IoWalletOutline,
} from "react-icons/io5";

const STEPS = {
  buyer: [
    { icon: IoSearchOutline, title: "Find the right service", body: "Search or browse categories, then compare packages, reviews and delivery times." },
    { icon: IoChatbubblesOutline, title: "Talk it through", body: "Message the seller with your brief, or ask for a custom offer." },
    { icon: IoShieldCheckmarkOutline, title: "Pay securely", body: "Your payment is held safely until the work is delivered." },
    { icon: IoCheckmarkDoneOutline, title: "Approve and review", body: "Request revisions if needed, approve the delivery, then leave a review." },
  ],
  seller: [
    { icon: IoPersonAddOutline, title: "Create your profile", body: "Add your skills, languages and portfolio so buyers can trust you." },
    { icon: IoBriefcaseOutline, title: "Publish a gig", body: "Set up to three packages, extras and an FAQ for what you offer." },
    { icon: IoRocketOutline, title: "Deliver great work", body: "Chat with buyers, send offers and deliver on time to level up." },
    { icon: IoWalletOutline, title: "Get paid", body: "Earnings are released when orders complete, then withdraw anytime." },
  ],
};

export default function HowItWorks() {
  const { t } = useI18n();
  const [tab, setTab] = useState("buyer");
  const steps = STEPS[tab];
  return (
    <section className="container mx-auto px-4 my-12" aria-labelledby="how-it-works">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 id="how-it-works" className="text-2xl md:text-3xl font-bold text-gray-900">{t("How it works")}</h2>
          <p className="mt-1 text-gray-600">{t("Simple steps whether you hire or sell.")}</p>
        </div>
        <div role="tablist" aria-label="How it works for" className="inline-flex self-start rounded-full bg-gray-100 p-1">
          {[["buyer", "For buyers"], ["seller", "For sellers"]].map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${tab === k ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="relative rounded-2xl border border-gray-200 bg-white p-5">
            <span className="absolute right-4 top-4 text-xs font-semibold text-gray-300">0{i + 1}</span>
            <s.icon className="text-2xl text-emerald-600" aria-hidden />
            <h3 className="mt-3 font-semibold text-gray-900">{t(s.title)}</h3>
            <p className="mt-1 text-sm text-gray-600">{t(s.body)}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5">
        <Link
          href={tab === "buyer" ? "/services" : "/sign-up"}
          className="inline-block px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          {t(tab === "buyer" ? "Browse services" : "Start selling")}
        </Link>
      </div>
    </section>
  );
}
