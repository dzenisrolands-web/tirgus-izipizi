import { Star } from "lucide-react";
import { type Review } from "@/lib/mock-data";

function StarRow({ count, filled }: { count: number; filled: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < count ? "text-amber-400" : "text-gray-200"}
          fill={i < count ? "currentColor" : "currentColor"}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Intl.DateTimeFormat("lv-LV", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(review.date));

  return (
    <div className="py-5 border-b border-gray-100 last:border-none">
      <div className="flex items-start gap-3">
        <img
          src={review.buyerAvatar}
          alt={review.buyerName}
          className="h-9 w-9 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{review.buyerName}</span>
            <span className="text-xs text-gray-400">{date}</span>
          </div>
          <div className="flex items-center gap-0.5 mt-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={13}
                fill="currentColor"
                className={i < review.stars ? "text-amber-400" : "text-gray-200"}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{review.comment}</p>
        </div>
      </div>
    </div>
  );
}

export function ReviewsSection({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
        Vēl nav atsauksmju par šo produktu.
      </div>
    );
  }

  const avg = reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10;

  // Count per star level
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.stars === star).length,
  }));

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900">
        Atsauksmes ({reviews.length})
      </h2>

      {/* Summary */}
      <div className="mt-4 flex gap-6 rounded-xl bg-gray-50 p-5">
        {/* Big score */}
        <div className="flex flex-col items-center justify-center shrink-0 min-w-[64px]">
          <span className="text-4xl font-extrabold text-gray-900">{rounded.toFixed(1)}</span>
          <div className="flex items-center gap-0.5 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                fill="currentColor"
                className={i < Math.round(avg) ? "text-amber-400" : "text-gray-200"}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 mt-1">{reviews.length} atsauksmes</span>
        </div>

        {/* Bar breakdown */}
        <div className="flex-1 space-y-1.5">
          {counts.map(({ star, count }) => {
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
                  <Star size={11} fill="currentColor" className="text-amber-400" />
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-4 shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review list */}
      <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 px-5">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
