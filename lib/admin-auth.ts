/**
 * Shared super-admin authentication helper.
 *
 * Super admin status lives in `app_metadata.is_super_admin` (set server-side
 * via Auth Admin API). This is NOT readable or writable by the client token,
 * so a compromised browser session can never escalate to admin.
 *
 * All `/api/admin/*` routes and the admin shell should use this module
 * instead of checking `profiles.role`.
 */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/** Service-role Supabase client — bypasses RLS, server-only. */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

/**
 * Extract Bearer token from request, verify the user, and assert
 * `app_metadata.is_super_admin === true`.
 *
 * Returns either `{ supabase, user }` on success or `{ error, status }`.
 */
export async function assertSuperAdmin(req: Request): Promise<
  | { supabase: SupabaseClient; user: User }
  | { error: string; status: 401 | 403 }
> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };

  const supabase = adminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { error: "Unauthorized", status: 401 };

  if (user.app_metadata?.is_super_admin !== true) {
    return { error: "Forbidden", status: 403 };
  }

  return { supabase, user };
}

/**
 * Lightweight boolean check — used when you only need a yes/no and don't
 * need the supabase client back.
 */
export async function isSuperAdmin(req: Request): Promise<boolean> {
  const result = await assertSuperAdmin(req);
  return !("error" in result);
}
