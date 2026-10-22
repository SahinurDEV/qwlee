// Admin gig edit: title, tags, description and package prices/delivery.
// Uses the same server-side validation as the seller wizard.
import { useState } from "react";
import { Modal } from "antd";
import toast from "react-hot-toast";
import Button from "../../common/Button";
import { adminFetch } from "../../utils/adminApi";
import { Field, input } from "./ui";

export default function GigEditModal({ gig, onClose, onSaved }) {
  const [title, setTitle] = useState(gig.title || "");
  const [tags, setTags] = useState((gig.tags || []).join(", "));
  const [description, setDescription] = useState(gig.description || "");
  const [pkgs, setPkgs] = useState((gig.package || []).map((p) => ({ ...p })));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await adminFetch(`/admin/gigs/${gig._id || gig.id}`, {
        method: "PATCH",
        body: {
          title,
          description,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          package: pkgs.map((p) => ({ ...p, price: Number(p.price), deliveryDate: Number(p.deliveryDate) })),
        },
      });
      toast.success("Gig updated");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onCancel={onClose} title="Edit gig" width={720} centered footer={null}>
      <div className="space-y-4">
        <Field label="Title"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Tags" hint="Comma separated, up to 5"><input className={input} value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <Field label="Description (HTML allowed, sanitised on save)">
          <textarea rows={6} className="w-full rounded-lg border border-ink-200 p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pkgs.map((p, i) => (
            <div key={i} className="rounded-xl border border-ink-200 p-3 space-y-2">
              <div className="text-sm font-semibold">{p.name}</div>
              <Field label="Price ($)"><input type="number" className={input} value={p.price} onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} /></Field>
              <Field label="Delivery (days)"><input type="number" className={input} value={p.deliveryDate} onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, deliveryDate: e.target.value } : x)))} /></Field>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
