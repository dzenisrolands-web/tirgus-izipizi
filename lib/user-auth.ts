/**
 * Shared helper for self-service account API routes (e.g. account deletion,
 * removing one's own seller profile). Verifies the caller's own Bearer token
 * and returns their user record — the route then acts ONLY on that user's
 * own data, never on an arbitrary user_id passed in the request body.
 */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/** Service-role Supabase client — bypasses RLS, server-only. */
function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

/**
 * Extract Bearer token from request and verify the user.
 * Returns either `{ supabase, user }` on success or `{ error, status }`.
 */
export async function assertUser(req: Request): Promise<
  | { supabase: SupabaseClient; user: User }
  | { error: string; status: 401 }
> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };

  const supabase = serviceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "Unauthorized", status: 401 };

  return { supabase, user };
}
