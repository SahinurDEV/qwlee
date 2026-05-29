// Blog admin — modern card grid with cover image, title, snippet,
// publish date and inline edit/delete.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Pagination } from "antd";
import { TbPlus, TbEdit, TbTrash } from "react-icons/tb";
import { IoCalendarOutline } from "react-icons/io5";
import toast from "react-hot-toast";

import { confirmModal } from "../../../common/confirm";

import {
  useDeleteBlogMutation,
  useGetBlogsQuery,
} from "../../../redux/api/apiSlice";

import PageHeader from "../../../common/PageHeader";
import Card from "../../../common/Card";
import Button from "../../../common/Button";
import { formatDate, truncate } from "../../../utils/format";
import getImageUrl from "../../../utils/getImageUrl";

export default function Blog() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useGetBlogsQuery(page);
  const [deleteBlog] = useDeleteBlogMutation();

  const blogs = data?.results || data?.data?.attributes?.results || [];
  const total = data?.totalResults || data?.data?.attributes?.totalResults || blogs.length;

  async function handleDelete(b) {
    const ok = await confirmModal({
      title: `Delete "${b.title}"?`,
      description: "This blog post will be permanently removed.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteBlog(b._id || b.id);
    if (res?.error) toast.error("Delete failed");
    else toast.success("Blog deleted");
  }

  return (
    <div>
      <PageHeader
        title="Blog"
        subtitle={`${total} post${total === 1 ? "" : "s"} published.`}
        actions={
          <Link to="/dashboard/addblog">
            <Button iconLeft={TbPlus}>Write a post</Button>
          </Link>
        }
      />

      {isFetching && blogs.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-white border border-ink-200 rounded-2xl shadow-card animate-pulse" />
          ))}
        </div>
      ) : blogs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-ink-700 font-medium">No blog posts yet</p>
            <p className="text-sm text-ink-500 mt-1">Publish a post to start your content marketing.</p>
            <Link to="/dashboard/addblog">
              <Button className="mt-4" iconLeft={TbPlus}>
                Write your first post
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blogs.map((b) => (
            <article
              key={b._id || b.id}
              className="bg-white border border-ink-200 rounded-2xl shadow-card overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[16/9] bg-ink-100">
                {b.image ? (
                  <img
                    src={getImageUrl(b.image)}
                    alt={b.title}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  />
                ) : null}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center text-xs text-ink-500 gap-1">
                  <IoCalendarOutline />
                  <span>{formatDate(b.createdAt)}</span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-ink-900 line-clamp-2">
                  {b.title}
                </h3>
                <p className="mt-1 text-sm text-ink-500 line-clamp-3">
                  {truncate(stripTags(b.description || b.content), 140)}
                </p>
                <div className="mt-auto pt-4 flex items-center gap-2">
                  <Link to={`/dashboard/editblog/${b._id || b.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" iconLeft={TbEdit} className="w-full">
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    iconLeft={TbTrash}
                    onClick={() => handleDelete(b)}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {total > 6 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={6}
            total={total}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
