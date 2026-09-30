import { createBrowserClient } from "@izipizi/db";
import type { Database } from "@izipizi/db";

export type UserRole = Database["public"]["Enums"]["user_role"];

/**
 * Get the current authenticated user (browser-side).
 */
export async function getCurrentUser() {
  const sb = createBrowserClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/**
 * Get all roles for the current user via RPC.
 */
export async function getUserRoles(): Promise<UserRole[]> {
  const sb = createBrowserClient();
  const { data, error } = await sb.rpc("current_roles");
  if (error || !data) return [];
  return data as UserRole[];
}

/**
 * Check if current user has a specific role (client-side).
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.includes(role);
}

/**
 * Server-side guard: throws redirect if user doesn't have the required role.
 * Use in server components or API routes.
 */
export async function requireRole(role: UserRole, token?: string): Promise<void> {
  // Import server client dynamically to avoid bundling service key
  const { createServerClient } = await import("@izipizi/db/server");
  const sb = createServerClient();

  if (!token) throw new Error("No auth token");

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  // Super admin bypasses all role checks
  if (user.app_metadata?.is_super_admin === true) return;
  if (user.app_metadata?.super_admin === true) return;

  // Check user_roles table
  const { data: roles } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", role);

  if (!roles || roles.length === 0) {
    throw new Error(`Forbidden: requires role ${role}`);
  }
}

export { type UserRole as Role };
