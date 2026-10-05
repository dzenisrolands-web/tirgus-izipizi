import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/track/open/[id]
 * Returns a 1×1 transparent PNG and records the open in the invitations table.
 * Used as <img> tracking pixel in invitation emails.
 */

// 1×1 transparent PNG (68 bytes)
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fire-and-forget DB update — don't block the pixel response
  if (id && id.length > 10) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
      );
      const now = new Date().toISOString();

      // Set opened_at only on first open (where opened_at is null)
      await supabase
        .from("invitations")
        .update({ opened_at: now, status: "opened" })
        .eq("id", id)
        .is("opened_at", null);

      // Increment opened_count every time
      const { data: row } = await supabase
        .from("invitations")
        .select("opened_count")
        .eq("id", id)
        .single();
      if (row) {
        await supabase
          .from("invitations")
          .update({ opened_count: (row.opened_count ?? 0) + 1 })
          .eq("id", id);
      }
    } catch {
      // Never fail the pixel response
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

// Edge runtime is fine for a simple pixel
export const runtime = "nodejs";
