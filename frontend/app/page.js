import HomePage from "@/components/Home/HomePage/HomePage";

// The homepage layout (section order, hidden sections, custom blocks) is
// set in Admin → Site settings → Homepage. Read it on the server, cached
// 60s like the rest of the site settings; the defaults apply if the API is
// unreachable.
async function homeLayout() {
  const bases = [process.env.INTERNAL_API_URL, process.env.NEXT_PUBLIC_BACKEND_API_URL].filter(Boolean);
  for (const b of bases) {
    try {
      const r = await fetch(`${b.replace(/\/+$/, "")}/v1/info/site`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(2000),
        headers: { "ngrok-skip-browser-warning": "1" },
      });
      if (r.ok) {
        const h = (await r.json())?.data?.attributes?.homepage;
        return { sections: h?.sections || [], blocks: h?.blocks || [] };
      }
    } catch {}
  }
  return null;
}

export default async function Home() {
  return <HomePage layout={await homeLayout()} />;
}
