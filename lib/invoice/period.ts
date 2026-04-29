/**
 * Self-billing invoice periods.
 * Two periods per month: 1st–15th and 16th–end-of-month.
 *
 * All dates are in UTC for consistency. Latvia is UTC+2/+3 (DST), but for
 * accounting periods we don't need that precision — just use UTC date boundaries.
 */

export type Period = {
  start: Date;
  end: Date;
  label: string; // e.g., "2026-04 (1.–15.)"
};

export function periodForDate(d: Date): Period {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (day <= 15) {
    return {
      start: new Date(Date.UTC(y, m, 1)),
      end: new Date(Date.UTC(y, m, 15, 23, 59, 59)),
      label: `${y}-${String(m + 1).padStart(2, "0")} (1.–15.)`,
    };
  }
  // 16th to end of month
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, 16)),
    end: new Date(Date.UTC(y, m, lastDay, 23, 59, 59)),
    label: `${y}-${String(m + 1).padStart(2, "0")} (16.–${lastDay}.)`,
  };
}

/**
 * Period that should be invoiced "now" — i.e., the most recently completed period.
 *
 * Cron runs at start of new period, so we look back one period:
 *   - Run on day 1: invoice the 16th–end of previous month
 *   - Run on day 16: invoice 1st–15th of current month
 */
export function previousPeriod(now: Date = new Date()): Period {
  const day = now.getUTCDate();
  if (day <= 15) {
    // Previous = 16th–end of last month
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - 1;
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
    return {
      start: new Date(Date.UTC(y, m, 16)),
      end: new Date(Date.UTC(y, m, lastDay, 23, 59, 59)),
      label: `${y}-${String(m + 1).padStart(2, "0")} (16.–${lastDay}.)`,
    };
  }
  // Previous = 1st–15th of this month
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1)),
    end: new Date(Date.UTC(y, m, 15, 23, 59, 59)),
    label: `${y}-${String(m + 1).padStart(2, "0")} (1.–15.)`,
  };
}

export function formatPeriodRange(p: Pick<Period, "start" | "end">): string {
  return `${p.start.toISOString().split("T")[0]} — ${p.end.toISOString().split("T")[0]}`;
}
