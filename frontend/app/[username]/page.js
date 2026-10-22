// Public profile page at /[username]. Server component — fetches data
// during render so the response carries real content + correct meta.
//
// Next.js matches static routes (/gig, /sign-in, etc.) before dynamic
// ones, so this won't shadow the existing pages. The backend's reserved-
// username list also prevents users from claiming those slugs in the
// first place.

import { notFound } from "next/navigation";
import { base } from "@/lib/constant";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import UsernameProfile from "@/components/Profile/Public/UsernameProfile";

async function fetchProfile(username) {
  try {
    const res = await fetch(
      `${base}/v1/users/by-username/${encodeURIComponent(username)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.attributes?.user || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { username } = await params;
  const user = await fetchProfile(username);
  if (!user) {
    return { title: `@${username} not found` };
  }
  // Layout exports `template: "%s"` — don't repeat the brand here.
  const title = `${user.fullName} (@${user.username})`;
  const description =
    user.intro ||
    user.about?.slice(0, 160) ||
    `${user.fullName} on Qwlee — ${user.role === "freelancer" ? "freelance services" : "buyer profile"}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(user.image ? { images: [{ url: user.image }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: { canonical: `/${user.username}` },
  };
}

export default async function UsernameProfilePage({ params }) {
  const { username } = await params;
  const user = await fetchProfile(username);
  if (!user) notFound();

  return (
    <PrimaryLayout>
      <UsernameProfile user={user} />
    </PrimaryLayout>
  );
}
