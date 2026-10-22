"use client";
import React, { useEffect, useState } from "react";
import { Form, Input } from "antd";
import Link from "next/link";
import { registerUser } from "@/actions/registerUser";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Button from "../CustomCreate/Button";
import GoogleSignInButton from "../common/GoogleSignInButton";
import AuthCard from "../common/AuthCard";
import { base } from "@/lib/constant";
import useIpLocation, { flagEmoji } from "@/hooks/useIpLocation";
import { IoLocationOutline } from "react-icons/io5";

// Mirror the backend's username regex for fast-fail before the API call.
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])?$/;

function useUsernameAvailability(username) {
  const [state, setState] = useState({ status: "idle", reason: "" });

  useEffect(() => {
    if (!username) {
      setState({ status: "idle", reason: "" });
      return;
    }
    const cleaned = username.trim().toLowerCase();
    if (cleaned.length < 3 || cleaned.length > 24) {
      setState({ status: "invalid", reason: "3–24 characters" });
      return;
    }
    if (!USERNAME_RE.test(cleaned)) {
      setState({
        status: "invalid",
        reason: "lowercase letters, numbers, _ or -",
      });
      return;
    }
    setState({ status: "checking", reason: "" });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${base}/v1/users/check-username/${encodeURIComponent(cleaned)}`,
          { signal: ctrl.signal }
        );
        const json = await res.json();
        const attrs = json?.data?.attributes;
        if (attrs?.available) setState({ status: "available", reason: "" });
        else
          setState({
            status: "unavailable",
            reason: attrs?.reason || "Unavailable",
          });
      } catch (err) {
        if (err?.name !== "AbortError") setState({ status: "idle", reason: "" });
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [username]);

  return state;
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong", "Strong"][score];
  return { score, label };
}

function SignUp() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const fromParam = params.get("from") || "";
  const availability = useUsernameAvailability(username);
  const pw = passwordStrength(password);
  const ip = useIpLocation();

  const handleSubmit = async (values) => {
    if (
      availability.status === "unavailable" ||
      availability.status === "invalid"
    ) {
      toast.error(`Username: ${availability.reason}`);
      return;
    }
    const newUser = {
      fullName: values.firstName + " " + values.lastName,
      email: values.email,
      password,
      role: "buyer",
      username: username.trim().toLowerCase(),
      // Auto-detected from IP — Fiverr-style. Stays empty if the lookup
      // failed; the user can edit it later via profile settings.
      location: ip.locationLabel || "",
    };
    try {
      const res = await registerUser(newUser);
      if (res?.code == 201) {
        // Forward the `from` deep-link through the OTP screen so the
        // final post-sign-in landing is the page the user originally
        // hit (e.g. /order/123 → sign-up → verify → sign-in → /order/123).
        const next = new URLSearchParams();
        next.set("email", values.email);
        if (fromParam.startsWith("/") && !fromParam.startsWith("//")) {
          next.set("from", fromParam);
        }
        router.push(`/verify-email?${next.toString()}`);
        toast.success(res?.message);
      } else {
        toast.error(res?.message);
      }
    } catch (error) {
      toast.error(error?.message);
    }
  };

  const statusColor =
    {
      available: "text-emerald-600",
      unavailable: "text-red-600",
      invalid: "text-red-600",
      checking: "text-gray-500",
      idle: "text-gray-400",
    }[availability.status] || "text-gray-400";

  const statusLabel =
    {
      available: "✓ Available",
      unavailable: `✗ ${availability.reason}`,
      invalid: `✗ ${availability.reason}`,
      checking: "Checking…",
      idle: "3–24 chars · letters, numbers, _ or -",
    }[availability.status] || "";

  const strengthBars = [0, 1, 2, 3, 4].map((i) => {
    const filled = i < pw.score;
    const color =
      pw.score <= 1
        ? "bg-red-400"
        : pw.score <= 3
        ? "bg-amber-400"
        : "bg-emerald-500";
    return (
      <div
        key={i}
        className={`h-1 flex-1 rounded ${filled ? color : "bg-gray-200"}`}
      />
    );
  });

  return (
    <AuthCard
      title="Create your Qwlee account"
      subtitle="Browse the marketplace as a buyer. You can become a seller anytime from your dashboard."
      width={560}
      footer={
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-emerald-700 font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      <GoogleSignInButton label="Sign up with Google" />
      <Form onFinish={handleSubmit} autoComplete="on" layout="vertical">
        <div className="flex gap-3 flex-col md:flex-row">
          <Form.Item
            className="w-full"
            name="firstName"
            label="First name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="First name" size="large" />
          </Form.Item>
          <Form.Item
            className="w-full"
            name="lastName"
            label="Last name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="Last name" size="large" />
          </Form.Item>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5">Username</label>
          <Input
            addonBefore="@"
            placeholder="username"
            aria-label="Username"
            size="large"
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase()
              )
            }
            maxLength={24}
          />
          <div className={`text-xs mt-1 ${statusColor}`}>{statusLabel}</div>
          {availability.status === "available" && (
            <div className="text-xs mt-0.5 text-gray-500">
              Your profile will be at qwlee.com/{username}
            </div>
          )}
        </div>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, message: "Please enter your email" }]}
        >
          <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" size="large" />
        </Form.Item>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <Input.Password
            placeholder="At least 8 characters with a number"
            aria-label="Password"
            size="large"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password ? (
            <div className="mt-2">
              <div className="flex gap-1.5">{strengthBars}</div>
              <div className="text-xs text-gray-500 mt-1">{pw.label}</div>
            </div>
          ) : null}
        </div>

        {/* IP-detected location — Fiverr-style "we see you're in <X>".
            No typed input; the user can edit it later from profile. */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 inline-flex items-center gap-1.5">
              <IoLocationOutline /> Country
            </span>
            <span className="text-gray-900 font-medium inline-flex items-center gap-1.5">
              {ip.loading ? (
                <span className="text-gray-400">Detecting…</span>
              ) : ip.locationLabel ? (
                <>
                  {ip.countryCode && (
                    <span aria-hidden className="text-base leading-none">
                      {flagEmoji(ip.countryCode)}
                    </span>
                  )}
                  <span>{ip.locationLabel}</span>
                </>
              ) : (
                <span className="text-gray-400">Couldn&rsquo;t detect — you can set this later</span>
              )}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Auto-detected from your connection. You can change it later in profile settings.
          </p>
        </div>

        <Button name={"Create account"} />
      </Form>
    </AuthCard>
  );
}

export default SignUp;
