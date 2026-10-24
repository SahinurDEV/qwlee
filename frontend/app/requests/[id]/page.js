import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import RequestDetail from "@/components/Requests/RequestDetail";
import { apiGet } from "@/lib/server";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const r = await apiGet(`/requests/${encodeURIComponent(id)}`);
  const req = r.ok ? r.data?.request || r.data : null;
  if (!req?.title) return { title: "Request", robots: { index: false } };
  const title = `${req.title} (buyer request)`;
  const budget = Number(req.budget) ? ` Budget $${Number(req.budget).toLocaleString()}.` : "";
  const description = `${String(req.description || "").replace(/\s+/g, " ").trim().slice(0, 140)}${budget}`.trim();
  const open = !req.status || req.status === "open";
  return {
    title,
    description,
    alternates: { canonical: `/requests/${id}` },
    robots: open ? undefined : { index: false },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  return (
    <PrimaryLayout>
      <RequestDetail id={id} />
    </PrimaryLayout>
  );
}
