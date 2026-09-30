import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Browser client — safe to use in components
export const supabase = createClient(url, publishableKey);

// Server-only client — never expose to browser
export function createServerClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient(url, secretKey);
}
