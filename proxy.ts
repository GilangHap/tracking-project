import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Penjaga route ala Auth.js untuk konvensi proxy Next 16.
 * - /admin/* tanpa sesi → /login
 * - /login dengan sesi → /admin/dashboard
 */
export const proxy = auth((request) => {
  const pathname = request.nextUrl.pathname;
  const loggedIn = Boolean(request.auth?.user);

  if (!loggedIn && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (loggedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
