import Link from "next/link";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <PrimaryLayout>
      <main className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-20">
        <p className="text-sm font-semibold text-emerald-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600">The page you are looking for doesn&apos;t exist or was moved.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Go home</Link>
          <Link href="/gig" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Browse services</Link>
        </div>
      </main>
    </PrimaryLayout>
  );
}
