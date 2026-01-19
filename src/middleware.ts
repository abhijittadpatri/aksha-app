import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieFromHeader, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/login", "/change-password"]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow Next internals & common static assets
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw") ||
    pathname.startsWith("/workbox")
  ) {
    return NextResponse.next();
  }

  // Allow public pages
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Allow API routes (API handlers enforce auth themselves where needed)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Everything else is protected
  const cookieHeader = req.headers.get("cookie");
  const uid = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);

  if (!uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
