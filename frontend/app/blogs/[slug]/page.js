import BlogDetails from "@/components/Blogs/BlogDetails";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import baseAxios from "@/lib/config";

// Next.js 16: `params` is a Promise — must be awaited before use.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const res = await baseAxios.get(`/blog/slug/${slug}`);
    const blog = res?.data?.data?.attributes;
    const title = blog?.title ? `${blog.title}` : `Blog`;
    const description = blog?.description || `Read this article on Qwlee.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    };
  } catch {
    return { title: "Blog" };
  }
}

export default async function Page({ params }) {
  const { slug } = await params;
  return (
    <PrimaryLayout>
      <BlogDetails slug={slug} />
    </PrimaryLayout>
  );
}
