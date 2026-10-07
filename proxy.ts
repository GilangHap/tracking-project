import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/session";

export function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
