"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Cookies from "js-cookie";
import { useDispatch } from "react-redux";
import { baseUrl } from "@/lib/constant";
import { storeUserInfo } from "@/actions/auth.services";
import { setUser } from "@/app/redux/slices/userSlice";

const ERRORS = {
  cancelled: "Google sign-in was cancelled.",
  invalid_state: "Your sign-in session expired. Please try again.",
  email_not_verified: "Your Google email address is not verified.",
  banned: "This account has been suspended.",
  account_deleted: "This account has been deleted.",
};

export default function GoogleCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const err = params.get("error");
    if (err) return setError(ERRORS[err] || "Google sign-in failed. Please try again.");
    const code = params.get("code");
    if (!code) return setError("Missing sign-in code.");
    fetch(`${baseUrl}/auth/google/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((res) => {
        const a = res?.data?.attributes;
        if (!a?.tokens?.access?.token) {
          const msg = String(res?.message || "");
          return setError(msg.startsWith("BANNED:") ? ERRORS.banned : msg || "Google sign-in failed.");
        }
        const opts = { expires: 30 };
        storeUserInfo({ accessToken: a.tokens.access.token });
        Cookies.set("user", JSON.stringify(a.user), opts);
        Cookies.set("accessToken", JSON.stringify(a.tokens.access.token), opts);
        Cookies.set("refreshToken", JSON.stringify(a.tokens.refresh.token), opts);
        dispatch(setUser(a.user));
        const from = params.get("from") || "/";
        router.replace(from.startsWith("/") && !from.startsWith("//") ? from : "/");
      })
      .catch(() => setError("Google sign-in failed. Please try again."));
  }, [params, router, dispatch]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-gray-800 mb-4">{error}</p>
          <Link href="/sign-in" className="text-emerald-700 font-medium">Back to sign in</Link>
        </div>
      ) : (
        <p className="text-gray-500">Signing you in…</p>
      )}
    </div>
  );
}
