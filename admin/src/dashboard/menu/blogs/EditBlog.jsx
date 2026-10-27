import { Button, Form, Input, Select, Switch, notification } from "antd";
import JoditEditor from "jodit-react";
import { useMemo, useRef, useState } from "react";
import { IoIosArrowBack } from "react-icons/io";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import { useUpdateBlogMutation } from "../../../redux/api/apiSlice";
import baseUrl from "../../../baseUrl";
import { adminFetch } from "../../../utils/adminApi";
import { PropagateLoader } from "react-spinners";

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function EditBlog() {
  const [updateBlog, { isLoading }] = useUpdateBlogMutation();
  const data = useLoaderData();
  const blog = data?.data?.attributes || {};
  const {
    title, image, content: initialContent, author, description, _id, kind,
    status, featured, slug, tags, categories, seo, scheduledAt,
  } = blog;

  const [body, setBody] = useState(initialContent || description || "");
  const [updateImage, setUpdateImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(image ? `${baseUrl}${image}` : "");
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const editor = useRef(null);
  const config = useMemo(
    () => ({
      readonly: false,
      height: 420,
      toolbarAdaptive: false,
      buttons:
        "bold,italic,underline,strikethrough,|,ul,ol,|,outdent,indent,|,font,fontsize,brush,paragraph,|,image,table,link,|,align,undo,redo,|,hr,copyformat,fullsize,preview,source",
      uploader: { insertImageAsBase64URI: true },
      askBeforePasteHTML: false,
    }),
    []
  );

  const onImage = (e) => {
    const file = e.target.files?.[0];
    setUpdateImage(file || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : image ? `${baseUrl}${image}` : "");
  };

  const suggestAi = async () => {
    try {
      const r = await adminFetch("/blog/suggest", {
        method: "POST",
        body: {
          title: form.getFieldValue("title"),
          content: body,
          description: form.getFieldValue("description"),
        },
      });
      const s = r?.suggestions || r?.data?.suggestions || r;
      form.setFieldsValue({
        title: s.title || form.getFieldValue("title"),
        description: s.excerpt || form.getFieldValue("description"),
        metaTitle: s.metaTitle,
        metaDescription: s.metaDescription,
        tags: (s.tags || []).join(", "),
        slug: slugify(s.title || form.getFieldValue("title")),
      });
      notification.success({ message: "AI suggestions applied", description: `Source: ${r?.source || r?.data?.source || "mock"}` });
    } catch (e) {
      notification.error({ message: "AI suggest failed", description: e.message });
    }
  };

  const onFinish = async (values) => {
    const formData = new FormData();
    formData.append("title", values.title);
    formData.append("author", values.author);
    formData.append("kind", values.kind || "article");
    formData.append("status", values.status || "published");
    formData.append("featured", values.featured ? "true" : "false");
    formData.append("slug", values.slug || slugify(values.title));
    formData.append("description", values.description || "");
    formData.append("content", body);
    formData.append("tags", values.tags || "");
    formData.append("categories", values.categories || "");
    formData.append("metaTitle", values.metaTitle || "");
    formData.append("metaDescription", values.metaDescription || "");
    formData.append("ogImage", values.ogImage || "");
    if (values.scheduledAt) formData.append("scheduledAt", values.scheduledAt);
    if (updateImage) formData.append("image", updateImage);
    try {
      await updateBlog({ _id, formData }).unwrap();
      notification.success({ message: "Saved", description: "Blog post updated." });
      navigate("/dashboard/blog");
    } catch (error) {
      notification.error({ message: "Error", description: error?.data?.message || "Could not update" });
    }
  };

  if (isLoading) {
    return (
      <div className="w-4/12 mx-auto mt-40">
        <PropagateLoader color="#00BF63" size={30} />
      </div>
    );
  }

  const toLocal = (d) => {
    if (!d) return "";
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
  };

  return (
    <div className="mt-6 mx-4 md:mx-6 pb-16" data-testid="blog-cms-editor-edit">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="font-semibold text-2xl flex items-center gap-2">
          <Link to="/dashboard/blog">
            <IoIosArrowBack className="bg-emerald-600 text-[24px] rounded-md text-white" />
          </Link>
          Edit blog post
        </p>
        <div className="flex gap-2">
          <Button onClick={suggestAi}>AI suggest</Button>
          <Button type="primary" className="!bg-emerald-600" onClick={() => form.submit()}>
            Save
          </Button>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          title,
          author,
          kind: kind || "article",
          status: status || "published",
          featured: !!featured,
          slug: slug || slugify(title),
          description: typeof description === "string" ? description.replace(/<[^>]+>/g, "").slice(0, 300) : "",
          tags: Array.isArray(tags) ? tags.join(", ") : tags || "",
          categories: Array.isArray(categories) ? categories.join(", ") : categories || "",
          metaTitle: seo?.metaTitle || "",
          metaDescription: seo?.metaDescription || "",
          ogImage: seo?.ogImage || "",
          scheduledAt: toLocal(scheduledAt),
        }}
        onFinish={onFinish}
        className="grid lg:grid-cols-[1fr_320px] gap-6"
      >
        <div className="space-y-4 bg-white rounded-2xl border border-ink-100 p-5">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input size="large" placeholder="Post title" />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
            <Input addonBefore="/" placeholder="url-slug" />
          </Form.Item>
          <Form.Item name="description" label="Excerpt" rules={[{ required: true }]}>
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="Short summary for cards and SEO" />
          </Form.Item>
          <div>
            <div className="text-sm font-medium mb-2">Body</div>
            <JoditEditor ref={editor} value={body} config={config} onBlur={(v) => setBody(v)} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-ink-100 p-4 space-y-3">
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "published", label: "Published" },
                ]}
              />
            </Form.Item>
            <Form.Item name="scheduledAt" label="Schedule for">
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="kind" label="Type">
              <Select options={[{ value: "article", label: "Article" }, { value: "guide", label: "Guide" }]} />
            </Form.Item>
            <Form.Item name="featured" label="Featured" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="author" label="Author" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="categories" label="Categories">
              <Input placeholder="freelance, tips" />
            </Form.Item>
            <Form.Item name="tags" label="Tags">
              <Input placeholder="pricing, ai, seo" />
            </Form.Item>
            <Form.Item label="Cover image">
              <input type="file" accept="image/*" onChange={onImage} />
              {previewUrl ? <img src={previewUrl} alt="" className="mt-2 rounded-lg max-h-40 object-cover w-full" /> : null}
            </Form.Item>
          </div>
          <div className="bg-white rounded-2xl border border-ink-100 p-4 space-y-3">
            <div className="font-semibold text-ink-900">SEO</div>
            <Form.Item name="metaTitle" label="Meta title">
              <Input maxLength={70} showCount />
            </Form.Item>
            <Form.Item name="metaDescription" label="Meta description">
              <Input.TextArea rows={3} maxLength={170} showCount />
            </Form.Item>
            <Form.Item name="ogImage" label="OG image URL">
              <Input placeholder="https://…" />
            </Form.Item>
          </div>
        </div>
      </Form>
    </div>
  );
}
