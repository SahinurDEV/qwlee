"use client";
import { useEffect, useState } from "react";
import { Checkbox, Input, Form } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { IoAlertCircleOutline } from "react-icons/io5";

import { userLogin } from "@/actions/userLogin";
import { storeUserInfo } from "@/actions/auth.services";
import { setUser } from "@/app/redux/slices/userSlice";
import Button from "../CustomCreate/Button";
import GoogleSignInButton from "../common/GoogleSignInButton";
import AuthCard from "../common/AuthCard";
import useIpLocation, { flagEmoji } from "@/hooks/useIpLocation";

const SignIn = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const ip = useIpLocation();
  // Banned users get a special 403 from the backend with the admin-set
  // reason. We surface that inline instead of as a toast so the user
  // sees the exact reason next to the form.
  //
  // Pre-populate from `?banned=<reason>` so the real-time logout via
  // socket (admin clicked Ban → SocketProvider force-redirected to
  // /sign-in) shows the same banner without needing the user to
  // attempt a new login.
  const [banReason, setBanReason] = useState("");
  useEffect(() => {
    const fromUrl = params.get("banned");
    if (fromUrl) setBanReason(decodeURIComponent(fromUrl));
  }, [params]);

  // Cross-link helpers — append `?from=` so clicking "Sign up" or
  // "Forgot password?" doesn't drop the user's original deep-link.
  const fromForLink = (() => {
    const f = params.get("from") || "";
    return f.startsWith("/") && !f.startsWith("//")
      ? `?from=${encodeURIComponent(f)}`
      : "";
  })();

  const handleSubmit = async (values) => {
    setBanReason("");
    try {
      const res = await userLogin({
        email: values.email,
        password: values.password,
      });

      if (res?.code === 403 && typeof res?.message === "string" && res.message.startsWith("BANNED:")) {
        setBanReason(res.message.slice("BANNED:".length).trim());
        return;
      }

      if (res?.data?.attributes?.tokens?.access?.token) {
        if (res?.data?.attributes?.user?.role === "admin") {
          toast.error("Admins sign in via the admin dashboard, not here.");
          return;
        }
        // "Keep me signed in" → 30-day persistent cookie. Otherwise we
        // drop the `expires` option which makes the cookies session-
        // scoped (cleared when the browser closes). Same option used
        // for `user`, `accessToken`, and `refreshToken` so all three
        // expire together.
        // "Keep me signed in" → 30-day persistent cookies (refresh-token
        // long-lived too). Unchecked → drop `expires` so the cookies are
        // session-scoped and the user is logged out when they close the
        // browser. localStorage (set by storeUserInfo) is always persistent;
        // that's fine because we clear it on logout anyway.
        const remember = !!values.remember;
        const cookieOpts = remember ? { expires: 30 } : {};
        storeUserInfo({
          accessToken: res?.data?.attributes?.tokens?.access?.token,
        });
        Cookies.set(
          "user",
          JSON.stringify(res?.data?.attributes?.user),
          cookieOpts
        );
        Cookies.set(
          "accessToken",
          JSON.stringify(res?.data?.attributes?.tokens?.access?.token),
          cookieOpts
        );
        Cookies.set(
          "refreshToken",
          JSON.stringify(res?.data?.attributes?.tokens?.refresh?.token),
          cookieOpts
        );
        dispatch(setUser(res?.data?.attributes?.user));
        // Honour `?from=<path>` set by the middleware when it bounced an
        // unauthenticated request — so the user lands back on the page
        // they originally wanted instead of dumping them at /. The
        // value is URL-encoded by the middleware; only allow internal
        // paths (starting with /) to prevent open-redirect attacks.
        const fromParam = params.get("from") || "";
        const safeFrom =
          fromParam.startsWith("/") && !fromParam.startsWith("//")
            ? fromParam
            : "/";
        router.push(safeFrom);
        toast.success(res?.message);
      } else {
        toast.error(res?.message);
      }
    } catch (error) {
      toast.error(error?.message);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to Qwlee."
      footer={
        <div className="space-y-1.5">
          <p className="text-sm text-gray-600">
            Don&rsquo;t have an account?{" "}
            <Link href={`/sign-up${fromForLink}`} className="text-emerald-700 font-medium">
              Sign up
            </Link>
          </p>
          {!ip.loading && ip.locationLabel && (
            <p className="text-xs text-gray-400">
              Signing in from{" "}
              {ip.countryCode && (
                <span aria-hidden className="align-middle">
                  {flagEmoji(ip.countryCode)}
                </span>
              )}{" "}
              <span className="text-gray-500">{ip.locationLabel}</span>
            </p>
          )}
        </div>
      }
    >
      {banReason && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800"
        >
          <IoAlertCircleOutline className="w-5 h-5 mt-0.5 shrink-0 text-rose-500" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Your account has been suspended
            </div>
            <p className="text-sm text-rose-700 mt-0.5 whitespace-pre-line">
              {banReason}
            </p>
            <p className="text-xs text-rose-500 mt-1">
              If you believe this is a mistake, contact support.
            </p>
          </div>
        </div>
      )}

      <GoogleSignInButton label="Continue with Google" />
      <Form
        onFinish={handleSubmit}
        autoComplete="on"
        layout="vertical"
        initialValues={{ remember: true }}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, message: "Please enter your email" }]}
        >
          <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="py-2" size="large" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: "Please enter your password" }]}
        >
          <Input.Password
            placeholder="Your password"
            className="py-2"
            size="large"
          />
        </Form.Item>
        <div className="flex justify-between items-center mb-3">
          <Form.Item
            name="remember"
            valuePropName="checked"
            noStyle
          >
            <Checkbox>Keep me signed in</Checkbox>
          </Form.Item>
          <Link
            href={`/forgot-password${fromForLink}`}
            className="text-sm text-emerald-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button name={"Sign In"} />
      </Form>
    </AuthCard>
  );
};

export default SignIn;
