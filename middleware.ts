import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Supabase v2 stores the session in a cookie named sb-<project-ref>-auth-token
// We check for its presence; full validation happens server-side in each route.
export function middleware(request: NextRequest) {
  const hasSession = [...request.cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
