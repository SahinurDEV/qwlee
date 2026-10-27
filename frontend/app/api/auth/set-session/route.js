import { NextResponse } from "next/server";

export const runtime = "nodejs";

function opts(maxAge) {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/** Mirror access/refresh tokens as HttpOnly cookies on the site origin (for edge middleware). */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const access = body.accessToken || body.access?.token;
  const refresh = body.refreshToken || body.refresh?.token;
  const remember = body.remember !== false;
  if (!access) {
    return NextResponse.json({ ok: false, message: "accessToken required" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  // 30d when remember, else session cookie (no maxAge).
  const accessAge = remember ? 30 * 24 * 60 * 60 : undefined;
  const refreshAge = remember ? 30 * 24 * 60 * 60 : undefined;
  res.cookies.set("accessToken", access, { ...opts(accessAge), ...(accessAge ? {} : {}) });
  if (refresh) {
    res.cookies.set("refreshToken", refresh, { ...opts(refreshAge) });
  }
  return res;
}
