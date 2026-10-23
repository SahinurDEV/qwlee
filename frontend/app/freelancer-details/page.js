import { redirect } from "next/navigation";

// Legacy URL. Profiles live at /:username now, so look the user up by id
// and send the visitor there; without a usable id, go to the talent list.
async function usernameFor(id) {
  if (!/^[a-f0-9]{24}$/i.test(String(id || ""))) return null;
  const bases = [process.env.INTERNAL_API_URL, process.env.NEXT_PUBLIC_BACKEND_API_URL].filter(Boolean);
  for (const b of bases) {
    try {
      const r = await fetch(`${b.replace(/\/+$/, "")}/v1/users/public?userId=${id}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
        headers: { "ngrok-skip-browser-warning": "1" },
      });
      if (r.ok) return (await r.json())?.data?.attributes?.user?.username || null;
    } catch {}
  }
  return null;
}

export default async function Page({ searchParams }) {
  const { id } = (await searchParams) || {};
  const username = await usernameFor(id);
  redirect(username ? `/${encodeURIComponent(username)}` : "/hire-freelancers");
}
