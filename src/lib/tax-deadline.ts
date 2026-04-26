import { notify } from './notifications-repo';

/**
 * Australian financial year ends 30 June. Returns the FY string (e.g. `2025-2026`)
 * the supplied date falls inside.
 */
export function currentFinancialYear(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Number of whole calendar days between `now` and the next 30 June (>= 0). */
export function daysUntilEofy(now: Date = new Date()): number {
  const fy = currentFinancialYear(now);
  const endYear = Number(fy.split('-')[1]);
  const eofy = new Date(endYear, 5, 30, 23, 59, 59); // June = 5
  const ms = eofy.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const TRIGGER_DAYS = [60, 30, 14, 7, 1, 0] as const;

/**
 * Emit a once-per-FY-per-trigger reminder when the EOFY is within a milestone
 * window. Idempotent — `dedupeId` keys the doc deterministically so refreshing
 * the page doesn't pile up duplicates.
 */
export async function maybeEmitEofyReminder(now: Date = new Date()): Promise<void> {
  const days = daysUntilEofy(now);
  // Pick the smallest trigger we've crossed. (e.g. 5 days out → emit the "7-day" reminder
  // since the 1-day one hasn't fired yet.)
  const trigger = TRIGGER_DAYS.find(t => days <= t);
  if (trigger === undefined) return;
  const fy = currentFinancialYear(now);
  const dedupeId = `tax-deadline-${fy}-${trigger}`;
  const title = trigger === 0
    ? 'Today is EOFY'
    : `${trigger} day${trigger === 1 ? '' : 's'} until EOFY`;
  const body = trigger === 0
    ? `End of financial year ${fy} — finalise deductions and stocktake before midnight.`
    : `EOFY (30 June) for FY ${fy} is ${trigger} day${trigger === 1 ? '' : 's'} away. Review your deductions on the Tax page.`;
  await notify({
    kind: 'tax-deadline',
    title,
    body,
    link: '/tax',
    dedupeId,
  });
}
