"use client";
// Buyer profile editor — shorter form than freelancers (no skills, no
// hourly rate). Same sectioned card system and save UX so the
// experience feels consistent across roles.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { Form, Input } from "antd";
import TextArea from "antd/es/input/TextArea";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { LuImagePlus } from "react-icons/lu";
import { IoArrowBack, IoSaveOutline, IoTrashOutline } from "react-icons/io5";

import useUser from "@/hooks/useUser";
import { setUser } from "@/app/redux/slices/userSlice";
import {
  useUpdateProfileImageMutation,
  useUpdateProfileMutation,
} from "@/app/redux/features/updateProfileApi";
import Avatar from "@/components/common/Avatar";

export default function BuyerEditProfile() {
  const user = useUser();
  const router = useRouter();
  const dispatch = useDispatch();

  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState("");

  const [updateImage, { isLoading: uploadingImage }] =
    useUpdateProfileImageMutation();
  const [setProfile, { isLoading: savingProfile }] = useUpdateProfileMutation();

  useEffect(() => {
    if (user === null) {
      toast.warning("Sign in to edit your profile");
      router.push("/sign-in");
    }
  }, [user, router]);

  if (!user) return null;

  function handlePickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setLocalPreview(URL.createObjectURL(file));
  }

  async function handleSavePhoto() {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("image", selectedFile);
    const res = await updateImage(formData);
    if (res.error) {
      toast.error(res.error.data?.message || "Could not update photo");
      return;
    }
    const next = res?.data?.data?.attributes;
    if (next) {
      Cookies.set("user", JSON.stringify(next));
      dispatch(setUser(next));
      toast.success("Profile photo updated");
      setSelectedFile(null);
      setLocalPreview("");
    }
  }

  function handleClearPhoto() {
    setSelectedFile(null);
    setLocalPreview("");
  }

  async function handleSaveProfile(values) {
    try {
      const res = await setProfile(values);
      if (res.error) {
        toast.error(res.error?.data?.message || "Failed to update profile");
        return;
      }
      const next = res?.data?.data?.attributes;
      if (next) {
        Cookies.set("user", JSON.stringify(next));
        dispatch(setUser(next));
      }
      toast.success("Profile saved");
      router.push("/profile");
    } catch (err) {
      toast.error(err?.message || "Failed to update profile");
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      <header className="mb-6 md:mb-8">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-2"
        >
          <IoArrowBack /> Back to profile
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Edit your profile
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          Tell sellers a bit about yourself — it helps them quote accurately.
        </p>
      </header>

      <SectionCard>
        <SectionHeader title="Profile photo" />
        <div className="flex items-center gap-5">
          <div className="relative">
            {localPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localPreview}
                alt="preview"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow"
              />
            ) : (
              <Avatar
                src={user?.image}
                name={user?.fullName}
                size={96}
                rounded
                className="ring-4 ring-white shadow"
              />
            )}
            <label
              htmlFor="profile-image"
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer shadow"
              aria-label="Change photo"
            >
              <LuImagePlus className="w-4 h-4" />
            </label>
            <input
              id="profile-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickFile}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleSavePhoto}
              disabled={!selectedFile || uploadingImage}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {uploadingImage ? "Uploading…" : "Update photo"}
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={handleClearPhoto}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <IoTrashOutline /> Cancel
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <Form
        layout="vertical"
        initialValues={{
          fullName: user?.fullName,
          about: user?.about,
          location: user?.location,
          language: user?.language,
        }}
        onFinish={handleSaveProfile}
        autoComplete="off"
      >
        <SectionCard>
          <SectionHeader title="Identity" hint="Shown on your public profile." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="fullName"
              label="Full name"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input size="large" placeholder="Your full name" />
            </Form.Item>
            <Form.Item label="Username">
              <Input
                size="large"
                value={`@${user?.username || ""}`}
                disabled
              />
            </Form.Item>
            <Form.Item
              name="location"
              label="Location"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input size="large" placeholder="City, country" />
            </Form.Item>
            <Form.Item name="language" label="Languages">
              <Input size="large" placeholder="e.g. English" />
            </Form.Item>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader title="About" />
          <Form.Item
            name="about"
            label="Bio"
            rules={[{ required: true, message: "Required" }]}
          >
            <TextArea
              rows={5}
              placeholder="Tell sellers what kinds of projects you typically hire for."
              maxLength={600}
              showCount
            />
          </Form.Item>
        </SectionCard>

        <div className="sticky bottom-0 bg-white/85 backdrop-blur border border-gray-200 rounded-2xl px-5 py-3 mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-1 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <IoSaveOutline />
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Form>
    </main>
  );
}

function SectionCard({ children }) {
  return (
    <section
      className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7 mb-5"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      {children}
    </section>
  );
}

function SectionHeader({ title, hint }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg md:text-xl font-semibold text-gray-900">{title}</h2>
      {hint ? <p className="text-sm text-gray-500 mt-0.5">{hint}</p> : null}
    </div>
  );
}
