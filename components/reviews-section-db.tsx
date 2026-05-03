"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Loader2, Send, CheckCircle, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DbReview = {
  id: string;
  listing_id: string;
  buyer_id: string | null;
  buyer_name: string;
  stars: number;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110">
          <Star size={28} fill="currentColor"
            className={s <= (hovered || value) ? "text-amber-400" : "text-gray-200"} />
        </button>
      ))}
    </div>
  );
}

export function ReviewsSectionDb({ listingId }: { listingId: string }) {
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [hasPurchased, setHasPurchased] = useState(false);
  const [orderIdForReview, setOrderIdForReview] = useState<string | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  async function loadReviews() {
    const { data } = await supabase
      .from("reviews")
      .select("id, listing_id, buyer_id, buyer_name, stars, comment, verified_purchase, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false });
    setReviews((data as DbReview[] | null) ?? []);
    setLoading(false);
  }

  async function loadAuthState() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCheckingAuth(false);
      return;
    }
    setUserId(user.id);

    // Get user's full name from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    setUserName(profile?.full_name ?? user.email?.split("@")[0] ?? "");

    // Check if user has a paid order with this listing
    const { data: orders } = await supabase
      .from("orders")
      .select("id, items")
      .eq("buyer_id", user.id)
      .eq("payment_status", "paid");
    const matchingOrder = (orders ?? []).find((o) => {
      const items = (o.items as Array<{ id?: string }> | null) ?? [];
      return items.some((it) => it.id === listingId);
    });
    if (matchingOrder) {
      setHasPurchased(true);
      setOrderIdForReview(matchingOrder.id as string);
    }

    // Check if user already reviewed
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("listing_id", listingId)
      .maybeSingle();
    setHasAlreadyReviewed(!!existing);

    setCheckingAuth(false);
  }

  useEffect(() => {
    loadReviews();
    loadAuthState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!userId) return setFormError("Lai atstātu atsauksmi, vispirms pieslēdzies");
    if (stars === 0) return setFormError("Izvēlies vērtējumu");
    if (comment.trim().length < 10) return setFormError("Atsauksme ir pārāk īsa (min. 10 rakstzīmes)");

    setSubmitting(true);
    try {
      // Get listing's seller_id for review record
      const { data: listing } = await supabase
        .from("listings")
        .select("seller_id")
        .eq("id", listingId)
        .single();

      const { error } = await supabase.from("reviews").insert({
        listing_id: listingId,
        seller_id: listing?.seller_id ?? null,
        buyer_id: userId,
        order_id: orderIdForReview,
        buyer_name: userName.trim() || "Pircējs",
        stars,
        comment: comment.trim(),
        verified_purchase: hasPurchased,
      });
      if (error) throw error;
      setSubmitted(true);
      setStars(0); setComment("");
      await loadReviews();
      setHasAlreadyReviewed(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Kļūda saglabājot");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
  );

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0;

  return (
    <div className="space-y-8">
      {/* Summary + list */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Atsauksmes ({reviews.length})</h2>

        {reviews.length > 0 && (
          <div className="mt-4 flex gap-6 rounded-xl bg-gray-50 p-5">
            <div className="flex flex-col items-center justify-center shrink-0">
              <span className="text-4xl font-extrabold text-gray-900">{avg.toFixed(1)}</span>
              <div className="flex mt-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={14} fill="currentColor"
                    className={s <= Math.round(avg) ? "text-amber-400" : "text-gray-200"} />
                ))}
              </div>
              <span className="mt-1 text-xs text-gray-400">{reviews.length} atsauksmes</span>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5,4,3,2,1].map(star => {
                const cnt = reviews.filter(r => r.stars === star).length;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-3 text-right text-xs text-gray-500">{star}</span>
                    <Star size={11} fill="currentColor" className="text-amber-400" />
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${reviews.length > 0 ? (cnt / reviews.length) * 100 : 0}%` }} />
                    </div>
                    <span className="w-4 text-xs text-gray-400">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="mt-4 rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
            Vēl nav atsauksmju. Esi pirmais!
          </div>
        ) : (
          <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 px-5">
            {reviews.map((r) => (
              <div key={r.id} className="py-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{r.buyer_name}</p>
                      {r.verified_purchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700" title="Verificēts pirkums">
                          <CheckCircle size={9} /> Pirkums
                        </span>
                      )}
                    </div>
                    <div className="flex mt-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={13} fill="currentColor"
                          className={s <= r.stars ? "text-amber-400" : "text-gray-200"} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "long", year: "numeric" })
                      .format(new Date(r.created_at))}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write review form — auth-aware */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-extrabold text-gray-900">Rakstīt atsauksmi</h3>

        {checkingAuth ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Pārbauda autentifikāciju...
          </div>
        ) : !userId ? (
          <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <Lock size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <div>
              <p>Lai atstātu atsauksmi, vispirms{" "}
                <Link href="/login" className="font-semibold text-brand-700 hover:underline">pieslēdzies</Link>.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Atsauksmes atļautas tikai reģistrētiem lietotājiem.
              </p>
            </div>
          </div>
        ) : hasAlreadyReviewed ? (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <CheckCircle size={15} className="shrink-0" />
            Tu jau esi atstājis atsauksmi šim produktam. Paldies!
          </div>
        ) : submitted ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            <Star size={15} fill="currentColor" className="text-green-500" />
            Paldies! Tava atsauksme ir pievienota.
          </div>
        ) : (
          <>
            {hasPurchased && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                <CheckCircle size={12} />
                <span>Tu esi nopircis šo produktu — atsauksme tiks atzīmēta kā <strong>Verificēts pirkums</strong>.</span>
              </div>
            )}
            {!hasPurchased && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <Lock size={12} />
                <span>Tu vēl nav nopircis šo produktu. Atsauksme būs publicēta, bet bez "Verificēts" zīmes.</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              {formError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vārds (no profila)</label>
                <input value={userName} onChange={e => setUserName(e.target.value)}
                  className="input w-full" placeholder="Tavs vārds" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Vērtējums *</label>
                <StarPicker value={stars} onChange={setStars} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Atsauksme *</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  rows={3} className="input w-full resize-none"
                  placeholder="Pastāsti par savu pieredzi ar šo produktu..." />
                <p className="mt-1 text-[10px] text-gray-400">
                  {comment.length} / min. 10 rakstzīmes
                </p>
              </div>
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-[#192635] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#243647] transition disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Nosūtīt atsauksmi
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
