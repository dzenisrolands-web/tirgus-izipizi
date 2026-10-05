"use client";

import { formatPrice } from "@/lib/utils";

type Day = { date: string; count: number; gmvCents: number };

// Tiny inline SVG bar+line chart — avoids pulling a chart library for one widget.
export function OrdersTimeline({ days }: { days: Day[] }) {
  const W = 700;
  const H = 160;
  const PADDING = 24;
  const innerW = W - PADDING * 2;
  const innerH = H - PADDING * 2;
  const max = Math.max(1, ...days.map((d) => d.count));
  const barW = innerW / days.length;

  const totalCount = days.reduce((s, d) => s + d.count, 0);
  const totalGmv = days.reduce((s, d) => s + d.gmvCents, 0);

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-baseline gap-3 text-xs text-gray-500">
        <span><strong className="text-gray-900">{totalCount}</strong> pasūtījumi</span>
        <span>·</span>
        <span><strong className="text-gray-900">{formatPrice(totalGmv / 100)}</strong> GMV</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pasūtījumi pēdējās 30 dienās">
        {/* Y axis grid */}
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const y = PADDING + innerH - innerH * p;
          return <line key={p} x1={PADDING} x2={W - PADDING} y1={y} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
        })}
        {/* Bars */}
        {days.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = PADDING + i * barW + 1;
          const y = PADDING + innerH - h;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={Math.max(0, barW - 2)}
                height={h}
                rx="2"
                fill={d.count > 0 ? "#53F3A4" : "#e5e7eb"}
              >
                <title>{`${d.date}: ${d.count} pasūt., ${formatPrice(d.gmvCents / 100)}`}</title>
              </rect>
            </g>
          );
        })}
        {/* X labels — first, middle, last */}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text
            key={i}
            x={PADDING + i * barW + barW / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize="10"
            fill="#9ca3af"
          >
            {days[i]?.date.slice(5) /* MM-DD */}
          </text>
        ))}
      </svg>
    </div>
  );
}
