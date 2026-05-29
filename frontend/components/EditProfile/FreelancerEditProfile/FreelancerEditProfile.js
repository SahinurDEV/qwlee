"use client";
// Sectioned freelancer profile editor.
//
// Layout: avatar card at the top with inline upload + save, then the rest
// of the profile in clearly grouped sections. Single "Save changes" button
// posts everything via useUpdateProfileMutation.
//
// Skills use react-tag-input (already a dep) — we always normalise the
// incoming user.skills array into {id, text} with non-empty text, since
// the underlying lib will crash on undefined text values.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { Form, Input, message } from "antd";
import TextArea from "antd/es/input/TextArea";
import { WithContext as ReactTags } from "react-tag-input";
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
import VerificationSection from "@/components/EditProfile/VerificationSection";

function normaliseSkills(rawSkills) {
  if (!Array.isArray(rawSkills)) return [];
  return rawSkills
    .map((s, i) => {
      if (typeof s === "string") return { id: `s-${i}`, text: s };
      const text = s?.text || s?.name || "";
      return { id: String(s?.id || `s-${i}`), text };
    })
    .filter((s) => s.text && s.text.trim());
}

export default function FreelancerEditProfile() {
  const loginUser = useUser();
  const router = useRouter();
  const dispatch = useDispatch();

  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState("");
  const [tags, setTags] = useState([]);

  // useUser() returns a fresh object reference on every render — so
  // `loginUser?.skills` is a NEW array each time, even when the contents
  // haven't changed. Depending on the array directly fires this effect
  // every render → setTags → re-render → loop. Compare by content
  // (cheap for ≤10 small objects) instead.
  const skillsSignature = JSON.stringify(loginUser?.skills || []);
  useEffect(() => {
    setTags(normaliseSkills(loginUser?.skills));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillsSignature]);

  const [updateImage, { isLoading: uploadingImage }] =
    useUpdateProfileImageMutation();
  const [setProfile, { isLoading: savingProfile }] = useUpdateProfileMutation();

  useEffect(() => {
    if (loginUser === null) {
      toast.warning("Sign in to edit your profile");
      router.push("/sign-in");
    }
  }, [loginUser, router]);

  if (!loginUser) return null;

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
      toast.error(res.error?.data?.message || "Could not update photo");
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
    const payload = {
      ...values,
      skills: tags.map((t) => ({ id: t.id, text: t.text })),
    };
    try {
      const res = await setProfile(payload);
      if (res.error) {
        toast.error(res.error.data?.message || "Could not save — please try again.");
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
      toast.error(err?.data?.message || "Failed to update profile");
    }
  }

  function handleAddSkill(tag) {
    if (!tag?.text || !String(tag.text).trim()) return;
    if (tags.length >= 10) {
      message.warning("You can add up to 10 skills.");
      return;
    }
    setTags([
      ...tags,
      { id: String(tag.id || `s-${Date.now()}`), text: String(tag.text).trim() },
    ]);
  }
  function handleDeleteSkill(i) {
    setTags(tags.filter((_, idx) => idx !== i));
  }

  return (
    <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
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
          A complete, accurate profile helps buyers find and trust you.
        </p>
      </header>

      <SectionCard>
        <SectionHeader
          title="Profile photo"
          hint="A clear headshot or recognisable logo works best."
        />
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
                src={loginUser?.image}
                name={loginUser?.fullName}
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
          fullName: loginUser?.fullName,
          intro: loginUser?.intro,
          about: loginUser?.about,
          location: loginUser?.location,
          language: loginUser?.language,
          perHourRate: loginUser?.perHourRate,
        }}
        onFinish={handleSaveProfile}
        autoComplete="off"
      >
        <SectionCard>
          <SectionHeader
            title="Identity"
            hint="Public details buyers see on your profile."
          />
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
                value={`@${loginUser?.username || ""}`}
                disabled
              />
              <div className="text-xs text-gray-400 mt-1">
                Your public profile is at qwlee.com/{loginUser?.username}
              </div>
            </Form.Item>
            <Form.Item
              name="location"
              label="Location"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input size="large" placeholder="City, country" />
            </Form.Item>
            <Form.Item name="language" label="Languages">
              <Input size="large" placeholder="e.g. English, Spanish" />
            </Form.Item>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="About"
            hint="One-line headline plus a longer bio. Be specific about who you help and how."
          />
          <Form.Item
            name="intro"
            label="Headline"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              size="large"
              placeholder="e.g. Full-stack developer · Next.js & Node specialist"
              maxLength={120}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="about"
            label="Bio"
            rules={[{ required: true, message: "Required" }]}
          >
            <TextArea
              rows={6}
              placeholder="Tell buyers what you do, who you've worked with, and how you work."
              maxLength={1200}
              showCount
            />
          </Form.Item>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Skills"
            hint="Up to 10. Type a skill and press Enter."
          />
          <ReactTags
            tags={tags}
            handleAddition={handleAddSkill}
            handleDelete={handleDeleteSkill}
            allowDragDrop={false}
            placeholder="Add a skill"
            classNames={{
              tagInput: "tag-input",
              tagInputField:
                "tag-input-field border border-gray-200 outline-none focus:border-emerald-500 rounded-lg w-full px-3 py-2 text-sm",
              selected: "selected-tag",
              tag: "bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full px-3 py-1 mr-2 text-sm",
              remove: "tag-remove",
            }}
          />
          <div className="text-xs text-gray-400 mt-2">
            {tags.length}/10 skills
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Rates"
            hint="Your hourly rate appears on your public profile and search cards."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="perHourRate" label="Hourly rate (USD)">
              <Input
                size="large"
                type="number"
                min={1}
                addonBefore="$"
                addonAfter="/hr"
                placeholder="e.g. 75"
              />
            </Form.Item>
          </div>
        </SectionCard>

        <VerificationSection user={loginUser} />

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
