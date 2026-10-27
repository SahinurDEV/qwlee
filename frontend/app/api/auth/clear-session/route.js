import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const base = { httpOnly: true, path: "/", sameSite: "lax" };
  res.cookies.set("accessToken", "", { ...base, maxAge: 0 });
  res.cookies.set("refreshToken", "", { ...base, maxAge: 0 });
  return res;
}
