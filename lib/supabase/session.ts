import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh sesi Supabase per request + jaga route /admin/*.
 * Dipakai oleh proxy.ts (konvensi Next 16 pengganti middleware.ts).
 */
export async function refreshSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Bisect logout misterius: bedakan "cookie tidak ada" vs "server menolak".
  // Lihat di Vercel Runtime Logs saat kelempar ke /login.
  if (!user) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.includes("-auth-token"));
    console.warn(
      `[auth-proxy] no-user path=${request.nextUrl.pathname} hasAuthCookie=${hasAuthCookie} err=${error?.message ?? "none"}`,
    );
  }

  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Sudah login tapi buka /login → lempar ke dashboard.
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
