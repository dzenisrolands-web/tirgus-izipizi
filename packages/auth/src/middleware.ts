import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "./index";

/**
 * Creates a Next.js middleware that gates routes by role.
 * Public paths (login, auth callback) are always accessible.
 *
 * Usage in each app's middleware.ts:
 *   import { withAuth } from "@izipizi/auth/middleware";
 *   export default withAuth("business");
 *   export const config = { matcher: ["/((?!_next|favicon|api).*)"] };
 */
export function withAuth(requiredRole: UserRole, publicPaths: string[] = ["/login", "/auth"]) {
  return async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public paths
    if (publicPaths.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    // Allow static files and Next internals
    if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
      return NextResponse.next();
    }

    // Check auth token from cookie
    const token =
      req.cookies.get("sb-access-token")?.value ??
      req.cookies.get(`sb-${getProjectRef()}-auth-token`)?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!
      );

      const { data: { user }, error } = await sb.auth.getUser(token);
      if (error || !user) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      // Super admin bypasses
      if (user.app_metadata?.is_super_admin === true) {
        return NextResponse.next();
      }

      // Check role
      const { data: roles } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", requiredRole);

      if (!roles || roles.length === 0) {
        return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
      }

      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  };
}

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/https:\/\/(\w+)\.supabase/);
  return match?.[1] ?? "unknown";
}
