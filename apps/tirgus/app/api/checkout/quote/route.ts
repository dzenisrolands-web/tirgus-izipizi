import { createClient } from "@supabase/supabase-js";
import { buildCheckoutQuote, checkoutBuyerId, checkoutFailure, checkoutJson, readCheckoutBody } from "@/lib/checkout-quote";

export async function POST(req: Request) {
  try {
    const body = await readCheckoutBody(req);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
    const buyerId = await checkoutBuyerId(req, supabase);
    const quote = await buildCheckoutQuote(supabase, body, buyerId);
    return checkoutJson({ ok: true, quote });
  } catch (error) { return checkoutFailure(error); }
}
