import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addSubscriber } from "@/lib/mailerlite";

/**
 * POST /api/subscribe
 * Subscribe an email to the newsletter.
 * Saves to email_subscribers table + syncs to MailerLite.
 */
export async function POST(req: Request) {
  try {
    const { email, name, source } = (await req.json()) as {
      email: string;
      name?: string;
      source?: string;
    };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Nederīgs e-pasts" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );

    // Save to DB (idempotent — upsert on email)
    const { error: dbErr } = await supabase.from("email_subscribers").upsert(
      {
        email: email.toLowerCase().trim(),
        name: name ?? null,
        source: source ?? "banner",
        subscribed_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (dbErr) {
      console.error("[subscribe] DB error:", dbErr.message);
      return NextResponse.json({ ok: false, error: dbErr.message }, { status: 500 });
    }

    // Sync to MailerLite (best-effort — don't fail the request)
    let mailerliteSynced = false;
    try {
      const mlResult = await addSubscriber(email, name);
      mailerliteSynced = mlResult.ok;
      if (mlResult.ok) {
        await supabase
          .from("email_subscribers")
          .update({ mailerlite_synced: true })
          .eq("email", email.toLowerCase().trim());
      }
    } catch {
      // MailerLite sync failed — will retry later or sync manually
    }

    return NextResponse.json({ ok: true, mailerliteSynced });
  } catch {
    return NextResponse.json({ ok: false, error: "Kļūda" }, { status: 500 });
  }
}
