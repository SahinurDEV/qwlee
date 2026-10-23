// Categories — admin grid view.
//
// Each tile shows the picked icon (react-icon by key, not an emoji)
// plus the name. The add/edit modal renders a searchable grid of every
// icon in the shared catalogue. Selecting one saves the key onto the
// category; the website resolves the same key into the same icon
// component for its navbar / dropdown.

import { useMemo, useState } from "react";
import { Modal as RModal } from "react-responsive-modal";
import { Form, Input, Pagination, Select } from "antd";
import toast from "react-hot-toast";

import { confirmModal } from "../../common/confirm";
import { IoSearch } from "react-icons/io5";
import { TbPlus, TbEdit, TbTrash } from "react-icons/tb";

import {
  useAddCategoryMutation,
  useDeleteCategoriesMutation,
  useGetCategoriesQuery,
  useUpdateCategoryMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import cls from "../../utils/cls";
import {
  CATEGORY_ICONS,
  iconForKey,
  DEFAULT_ICON_KEY,
} from "../../common/categoryIcons";

import "react-responsive-modal/styles.css";

export default function CategoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isFetching } = useGetCategoriesQuery(page);
  const [addCategory, { isLoading: adding }] = useAddCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoriesMutation();

  const all = data?.results || data?.data?.attributes?.results || [];
  const rowId = (c) => c?.id || c?._id;
  // Top-level categories are tiles; subcategories are listed on their parent.
  const results = all.filter((c) => !c.parentId);
  const subsByParent = useMemo(() => {
    const m = {};
    for (const c of all) if (c.parentId) (m[String(c.parentId)] ||= []).push(c);
    return m;
  }, [all]);
  const totalResults =
    data?.totalResults ||
    data?.data?.attributes?.totalResults ||
    results.length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (subsByParent[String(rowId(c))] || []).some((s) => s.name.toLowerCase().includes(q))
    );
  }, [results, search, subsByParent]);

  const [editing, setEditing] = useState(null);
  const [iconKey, setIconKey] = useState(DEFAULT_ICON_KEY);
  const [iconSearch, setIconSearch] = useState("");
  const [form] = Form.useForm();

  const iconResults = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return CATEGORY_ICONS;
    return CATEGORY_ICONS.filter(
      (e) => e.key.includes(q) || e.label.toLowerCase().includes(q)
    );
  }, [iconSearch]);

  function openCreate(parent) {
    form.resetFields();
    if (parent) form.setFieldsValue({ parentId: rowId(parent) });
    setIconKey(DEFAULT_ICON_KEY);
    setIconSearch("");
    setEditing({});
  }
  function openEdit(row) {
    form.setFieldsValue({ name: row.name, parentId: row.parentId || undefined });
    setIconKey(row.icon || DEFAULT_ICON_KEY);
    setIconSearch("");
    setEditing(row);
  }
  function close() {
    setEditing(null);
    setIconKey(DEFAULT_ICON_KEY);
    setIconSearch("");
    form.resetFields();
  }

  async function handleSubmit({ name, parentId }) {
    // The categories routes use multer middleware which is happy
    // without a file attached. Same FormData shape for create + update
    // so we don't need to branch on content-type.
    const formData = new FormData();
    formData.append("name", name);
    formData.append("icon", iconKey);
    formData.append("parentId", parentId || "");
    let res;
    if (editing && rowId(editing)) {
      res = await updateCategory({ id: rowId(editing), formData });
    } else {
      res = await addCategory(formData);
    }
    if (res?.error) {
      toast.error(res.error?.data?.message || "Save failed");
      return;
    }
    toast.success(rowId(editing) ? "Category updated" : "Category added");
    close();
  }

  async function handleDelete(row) {
    const ok = await confirmModal({
      title: `Delete ${row.name}?`,
      description: "Gigs in this category will lose their classification.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteCategory(rowId(row));
    if (res?.error) toast.error(res.error?.data?.message || "Delete failed");
    else toast.success("Category deleted");
  }

  const SelectedIcon = iconForKey(iconKey);

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${totalResults} categor${totalResults === 1 ? "y" : "ies"} on the marketplace.`}
        actions={
          <>
            <div className="flex items-center bg-white border border-ink-200 rounded-lg px-3 w-64 focus-within:border-primary">
              <IoSearch className="text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories…"
                className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
              />
            </div>
            <Button iconLeft={TbPlus} onClick={() => openCreate()}>
              Add category
            </Button>
          </>
        }
      />

      {isFetching && visible.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white border border-ink-200 rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-ink-700 font-medium">No categories yet</p>
            <p className="text-sm text-ink-500 mt-1">
              Add your first one to start populating the marketplace taxonomy.
            </p>
            <Button className="mt-4" iconLeft={TbPlus} onClick={() => openCreate()}>
              Add category
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map((c) => {
            const Icon = iconForKey(c.icon);
            return (
              <div
                key={rowId(c)}
                className="group relative bg-white border border-ink-200 rounded-2xl shadow-card p-4 flex flex-col items-center text-center hover:border-primary-200 transition"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
                  <Icon className="w-7 h-7 text-primary-700" />
                </div>
                <div className="text-sm font-medium text-ink-900 truncate w-full">
                  {c.name}
                </div>
                <div className="mt-2 mb-3 flex flex-wrap justify-center gap-1">
                  {(subsByParent[String(rowId(c))] || []).map((s) => (
                    <button
                      key={rowId(s)}
                      type="button"
                      onClick={() => openEdit(s)}
                      title="Edit subcategory"
                      className="text-xs px-2 py-0.5 rounded-full bg-ink-50 border border-ink-200 text-ink-700 hover:border-primary-300"
                    >
                      {s.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => openCreate(c)}
                    className="text-xs px-2 py-0.5 rounded-full border border-dashed border-ink-300 text-ink-500 hover:text-primary-700"
                  >
                    + sub
                  </button>
                </div>
                <div className="absolute inset-x-2 -bottom-2 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <Button
                    size="sm"
                    variant="secondary"
                    iconLeft={TbEdit}
                    onClick={() => openEdit(c)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    iconLeft={TbTrash}
                    onClick={() => handleDelete(c)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalResults > 300 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={300}
            total={totalResults}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      )}

      <RModal
        open={!!editing}
        onClose={close}
        center
        classNames={{ modal: "rounded-2xl !p-0 !m-0", overlay: "bg-black/40" }}
      >
        <div className="w-[560px] max-w-[92vw] p-6">
          <h3 className="text-lg font-semibold text-ink-900">
            {rowId(editing) ? "Edit category" : "Add category"}
          </h3>
          <p className="text-sm text-ink-500 mt-1 mb-4">
            Pick the icon that represents this category — it shows up on
            the marketplace navbar, the category strip, and the dropdown.
          </p>
          <Form form={form} onFinish={handleSubmit} layout="vertical">
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="e.g. Graphic Design" size="large" />
            </Form.Item>
            <Form.Item name="parentId" label="Parent category (leave empty for a top-level category)">
              <Select
                allowClear
                size="large"
                placeholder="None — top-level"
                options={results
                  .filter((c) => rowId(c) !== rowId(editing))
                  .map((c) => ({ value: rowId(c), label: c.name }))}
              />
            </Form.Item>

            <div className="mb-3 flex items-center gap-3 px-3 py-2 rounded-xl border border-ink-200 bg-ink-50/60">
              <span className="w-12 h-12 rounded-xl bg-white border border-ink-200 flex items-center justify-center">
                <SelectedIcon className="w-6 h-6 text-primary-700" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900">
                  Selected icon
                </div>
                <div className="text-xs text-ink-500 truncate">
                  Key: <span className="font-mono">{iconKey}</span>
                </div>
              </div>
            </div>

            <div className="mb-2 flex items-center bg-white border border-ink-200 rounded-lg px-3 focus-within:border-primary">
              <IoSearch className="text-ink-400" />
              <input
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Search icons (e.g. code, music, rocket)…"
                className="px-2 py-2 bg-transparent outline-none text-sm flex-1"
              />
            </div>
            <div className="grid grid-cols-8 gap-1.5 max-h-[260px] overflow-y-auto border border-ink-100 rounded-xl p-2 bg-ink-50/40">
              {iconResults.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIconKey(key)}
                  title={label}
                  className={cls(
                    "h-11 w-11 rounded-lg flex items-center justify-center transition",
                    iconKey === key
                      ? "bg-primary-50 ring-2 ring-primary-300 text-primary-800"
                      : "bg-white hover:bg-ink-100 text-ink-700"
                  )}
                  aria-label={label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
              {iconResults.length === 0 && (
                <div className="col-span-8 px-3 py-6 text-center text-sm text-ink-500">
                  No icons match &ldquo;{iconSearch}&rdquo;.
                </div>
              )}
            </div>
            <div className="mt-1 text-xs text-ink-400">
              {iconResults.length} icon{iconResults.length === 1 ? "" : "s"}{" "}
              {iconSearch ? "match" : "available"}.
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={close} type="button">
                Cancel
              </Button>
              <Button type="submit" loading={adding || updating}>
                {rowId(editing) ? "Save changes" : "Create category"}
              </Button>
            </div>
          </Form>
        </div>
      </RModal>
    </div>
  );
}
