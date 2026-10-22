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
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  const finish = (a) => {
    const opts = { expires: 30 };
    storeUserInfo({ accessToken: a.tokens.access.token });
    Cookies.set("user", JSON.stringify(a.user), opts);
    Cookies.set("accessToken", JSON.stringify(a.tokens.access.token), opts);
    Cookies.set("refreshToken", JSON.stringify(a.tokens.refresh.token), opts);
    dispatch(setUser(a.user));
    const from = params.get("from") || "/";
    router.replace(from.startsWith("/") && !from.startsWith("//") ? from : "/");
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/auth/2fa/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge, code: code.trim() }),
      }).then((r) => r.json());
      if (res?.data?.attributes?.tokens?.access?.token) return finish(res.data.attributes);
      setError(res?.message || "That code is not valid.");
    } catch {
      setError("Could not check the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
        if (a?.twoFactorRequired && a?.challenge) return setChallenge(a.challenge);
        if (!a?.tokens?.access?.token) {
          const msg = String(res?.message || "");
          return setError(msg.startsWith("BANNED:") ? ERRORS.banned : msg || "Google sign-in failed.");
        }
        finish(a);
      })
      .catch(() => setError("Google sign-in failed. Please try again."));
  }, [params, router, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      {challenge ? (
        <form onSubmit={verify} className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">Two-factor sign-in</h1>
          <label htmlFor="otp" className="block text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app, or a recovery code.
          </label>
          <input
            id="otp"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="123456"
          />
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <button disabled={busy || !code.trim()} className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50">
            {busy ? "Checking…" : "Verify"}
          </button>
          <Link href="/sign-in" className="block text-center text-sm text-emerald-700">Back to sign in</Link>
        </form>
      ) : error ? (
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
