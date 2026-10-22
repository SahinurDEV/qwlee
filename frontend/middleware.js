// Edge-runtime auth gate for the Qwlee marketplace.
//
// Strategy:
//   • PROTECTED_PREFIXES — any request whose path starts with one of
//     these is forced through `verifyAccessToken`. Catches nested
//     routes (`/order/:id`, `/inbox/:chatId`, `/support/:ticketId`)
//     that the old literal-Set matcher silently let through.
//   • SIGNED_OUT_ONLY_PREFIXES — auth screens that already-logged-in
//     users should be bounced away from (sign-in / sign-up / forgot
//     password / verify email / change password).
//   • Everything else is public (home, browse, gig detail, public
//     profiles, blogs, legal, etc.).
//
// JWT verification uses the same `JWT_SECRET` as the backend. If the
// secret env var is missing we fall back to a token-presence check so
// the gate still bites — better than disabling the middleware entirely.

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/earnings",
  "/inbox",
  "/list",
  "/order",
  "/notifications",
  "/support",
  "/gig/add",
  "/requests/new",
  "/requests/mine",
  "/gig/edit",
  "/change-password",
];

const SIGNED_OUT_ONLY_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/verify-email",
];

const encoder = new TextEncoder();

async function verifyAccessToken(token, secret) {
  if (!token) return null;
  if (!secret) {
    // No secret configured → degrade to presence-check. Better to
    // require *some* token than to leave every protected route open.
    return { sub: "presence-only" };
  }
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    if (payload.type && payload.type !== "access") return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function matchesPrefix(pathname, prefixes) {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAuthOnly = matchesPrefix(pathname, SIGNED_OUT_ONLY_PREFIXES);

  if (!isProtected && !isAuthOnly) return NextResponse.next();

  const raw = request.cookies.get("accessToken")?.value;
  // The frontend SignIn stores cookies JSON-stringified — strip the
  // surrounding quotes before handing the value to JWT verify.
  const token = raw ? raw.replace(/^"(.*)"$/, "$1") : null;
  const payload = await verifyAccessToken(token, process.env.JWT_SECRET);
  const isAuthed = !!payload;

  if (isProtected && !isAuthed) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthOnly && isAuthed) {
    // Already signed in — bounce away from the auth screens.
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Matcher uses prefix patterns so nested routes (e.g. `/order/abc123`,
// `/inbox/xyz`, `/support/123/messages`) actually hit the middleware.
// `next-auth`-style wildcards via the colon-pattern syntax.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/earnings/:path*",
    "/inbox/:path*",
    "/list/:path*",
    "/order/:path*",
    "/notifications/:path*",
    "/support/:path*",
    "/gig/add/:path*",
    "/requests/new/:path*",
    "/requests/mine/:path*",
    "/gig/edit/:path*",
    "/change-password/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/forgot-password/:path*",
    "/verify-email/:path*",
  ],
};
