import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import HelpArticle from "@/components/Help/HelpArticle";

export const metadata = { title: "Help centre" };

export default async function Page({ params }) {
  const { slug } = await params;
  return (
    <PrimaryLayout>
      <HelpArticle slug={slug} />
    </PrimaryLayout>
  );
}
