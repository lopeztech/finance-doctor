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

/**
 * Days until the 31 October self-lodgement deadline for the most recently
 * closed FY. Once we're past 31 October, returns 0 — the next year's reminder
 * will pick up on 1 July.
 */
export function daysUntilLodgement(now: Date = new Date()): number {
  // Lodgement deadline applies to the FY that ended on the previous 30 June.
  // Between 1 July and 31 October, that's the FY for July's calendar year - 1.
  // Between 1 November and 30 June, the next deadline is October of the
  // CURRENT FY's end year.
  const m = now.getMonth() + 1;
  let endYear: number;
  if (m >= 7) {
    // Past 30 June → lodgement is this calendar year's 31 Oct.
    endYear = now.getFullYear();
  } else {
    // Before 30 June → previous calendar year's 31 Oct (already passed) is
    // irrelevant; surface the upcoming one (this year's 31 Oct will hit after
    // EOFY).
    endYear = now.getFullYear();
  }
  const lodgement = new Date(endYear, 9, 31, 23, 59, 59);
  const ms = lodgement.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const EOFY_TRIGGER_DAYS = [60, 30, 14, 7, 1, 0] as const;
const LODGEMENT_TRIGGER_DAYS = [30, 7, 1, 0] as const;

async function emitEofyTrigger(fy: string, days: number): Promise<void> {
  const trigger = EOFY_TRIGGER_DAYS.find(t => days <= t);
  if (trigger === undefined) return;
  const dedupeId = `tax-deadline-${fy}-${trigger}`;
  const title = trigger === 0
    ? 'Today is EOFY'
    : `${trigger} day${trigger === 1 ? '' : 's'} until EOFY`;
  const body = trigger === 0
    ? `End of financial year ${fy} — finalise deductions and stocktake before midnight.`
    : `EOFY (30 June) for FY ${fy} is ${trigger} day${trigger === 1 ? '' : 's'} away. Review your deductions on the Tax page.`;
  await notify({ kind: 'tax-deadline', title, body, link: '/eofy', dedupeId });
}

async function emitLodgementTrigger(fy: string, days: number): Promise<void> {
  const trigger = LODGEMENT_TRIGGER_DAYS.find(t => days <= t);
  if (trigger === undefined) return;
  const dedupeId = `tax-lodgement-${fy}-${trigger}`;
  const title = trigger === 0
    ? 'Today is the ATO self-lodgement deadline'
    : `${trigger} day${trigger === 1 ? '' : 's'} until ATO self-lodgement deadline`;
  const body = trigger === 0
    ? `Lodge your FY ${fy} return today to avoid late penalties.`
    : `Self-lodgement for FY ${fy} closes 31 October — ${trigger} day${trigger === 1 ? '' : 's'} to go.`;
  await notify({ kind: 'tax-deadline', title, body, link: '/eofy', dedupeId });
}

/**
 * Emit milestone reminders for both the 30 June EOFY and the 31 October
 * lodgement deadline. Idempotent via deterministic `dedupeId`s.
 */
export async function maybeEmitEofyReminder(now: Date = new Date()): Promise<void> {
  const fy = currentFinancialYear(now);
  await emitEofyTrigger(fy, daysUntilEofy(now));

  // Lodgement applies to the just-closed FY between July and October.
  const m = now.getMonth() + 1;
  if (m >= 7 && m <= 10) {
    const startYear = Number(fy.split('-')[0]);
    const closedFy = `${startYear - 1}-${startYear}`;
    await emitLodgementTrigger(closedFy, daysUntilLodgement(now));
  }
}
