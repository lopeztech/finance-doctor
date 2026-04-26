import type { Expense } from './types';
import { currentFinancialYear } from './tax-deadline';

export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
  /** True when the underlying condition is satisfied automatically. */
  done: boolean;
  /** Optional in-app deep link the user should follow to satisfy the item. */
  link?: string;
  /** Optional advisory shown when not done. */
  hint?: string;
}

export interface ChecklistInput {
  financialYear: string;
  expenses: Expense[];
  /** Member ids who claimed the WFH category in the FY. */
  wfhClaimantIds?: string[];
  /** Member ids who logged WFH hours for the FY. */
  wfhHoursLoggedFor?: string[];
  /** Investment ids that have a vehicle logbook % set. */
  vehicleLogbookSet?: boolean;
  /** True when dividend statements have been imported. */
  dividendsImported?: boolean;
  /** True when CGT has been reconciled per investment. */
  cgtReconciled?: boolean;
  /** Annual super salary-sacrifice across the household, AUD. */
  superSalarySacrificeTotal?: number;
  /** True when the user has at least one insurance + one donation expense. */
  hasInsurance?: boolean;
  hasDonations?: boolean;
}

export const SUPER_CONCESSIONAL_CAP = 30000;

function fyEndDate(financialYear: string): Date {
  const endYear = Number(financialYear.split('-')[1]);
  return new Date(endYear, 5, 30, 23, 59, 59); // June = 5
}

function lodgementDate(financialYear: string): Date {
  // ATO self-lodgement deadline = 31 October following the FY end.
  const endYear = Number(financialYear.split('-')[1]);
  return new Date(endYear, 9, 31, 23, 59, 59); // Oct = 9
}

export function daysUntilEofyEnd(financialYear: string, now: Date = new Date()): number {
  const ms = fyEndDate(financialYear).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function daysUntilLodgement(financialYear: string, now: Date = new Date()): number {
  const ms = lodgementDate(financialYear).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * EOFY season is when the EOFY checklist takes pride of place: from 1 May
 * through to 31 July (covers the run-up + the immediate post-EOFY scramble).
 */
export function isEofySeason(now: Date = new Date()): boolean {
  const m = now.getMonth() + 1; // 1-12
  return m >= 5 && m <= 7;
}

/**
 * Reminder days for both the 30 June EOFY and the 31 Oct lodgement deadline.
 * Used by the tax-deadline emitter and the dashboard banner.
 */
export const EOFY_REMINDER_DAYS = [60, 30, 14, 7, 1, 0] as const;
export const LODGEMENT_REMINDER_DAYS = [30, 7, 1, 0] as const;

const RECEIPT_THRESHOLD = 300;

export function evaluateEofyChecklist(input: ChecklistInput): ChecklistItem[] {
  const fyExpenses = input.expenses.filter(e => e.financialYear === input.financialYear);

  const pendingCount = fyExpenses.filter(e => e.categorisationStatus === 'pending').length;
  const failedCount = fyExpenses.filter(e => e.categorisationStatus === 'failed').length;

  // Receipts plumbing is in the document vault (not yet shipped). Surface the
  // count of >= $300 deductions so the user knows what to attach later.
  const largeDeductions = fyExpenses.filter(e => !e.nonDeductible && e.amount >= RECEIPT_THRESHOLD);

  const wfhClaimants = new Set(input.wfhClaimantIds ?? []);
  const wfhHoursLogged = new Set(input.wfhHoursLoggedFor ?? []);
  const wfhUnlogged = [...wfhClaimants].filter(id => !wfhHoursLogged.has(id));

  const insuranceClaimed = input.hasInsurance ?? fyExpenses.some(e => e.spendingCategory === 'Insurance' && !e.nonDeductible);
  const donationClaimed = input.hasDonations ?? fyExpenses.some(e => e.category === 'Donations' && !e.nonDeductible);

  const superExceeded = (input.superSalarySacrificeTotal ?? 0) > SUPER_CONCESSIONAL_CAP;
  const items: ChecklistItem[] = [
    {
      id: 'categorise-all',
      label: 'All FY expenses categorised',
      done: pendingCount === 0 && failedCount === 0,
      detail: pendingCount + failedCount > 0
        ? `${pendingCount + failedCount} expense${pendingCount + failedCount === 1 ? '' : 's'} still pending or failed`
        : undefined,
      link: '/expenses',
      hint: 'Bulk-categorise via the Expenses page.',
    },
    {
      id: 'large-deduction-receipts',
      label: 'Receipts attached to deductions ≥ $300',
      done: largeDeductions.length === 0,
      detail: largeDeductions.length > 0
        ? `${largeDeductions.length} deduction${largeDeductions.length === 1 ? '' : 's'} ≥ $300 to back up with a receipt`
        : undefined,
      hint: 'The document vault is on the way — for now, keep PDFs handy and ATO-ready.',
    },
    {
      id: 'wfh-hours-logged',
      label: 'WFH hours logged for each claimant',
      done: wfhUnlogged.length === 0,
      detail: wfhUnlogged.length > 0 ? `${wfhUnlogged.length} member(s) missing hours` : undefined,
      link: '/tax',
    },
    {
      id: 'vehicle-logbook',
      label: 'Vehicle logbook % entered',
      done: Boolean(input.vehicleLogbookSet),
      hint: 'Open the relevant vehicle expense and set the business-use percentage.',
      link: '/expenses',
    },
    {
      id: 'dividends-imported',
      label: 'Dividend statements imported',
      done: Boolean(input.dividendsImported),
      link: '/cashflow',
    },
    {
      id: 'cgt-reconciled',
      label: 'Capital gains/losses reconciled per investment',
      done: Boolean(input.cgtReconciled),
      link: '/investments',
    },
    {
      id: 'super-cap',
      label: `Super salary-sacrifice cap not exceeded ($${SUPER_CONCESSIONAL_CAP.toLocaleString('en-AU')} concessional)`,
      done: !superExceeded,
      detail: superExceeded
        ? `Total ${formatAud(input.superSalarySacrificeTotal ?? 0)} is over the cap — review with your accountant`
        : undefined,
    },
    {
      id: 'insurance-donations',
      label: 'Insurance + donations logged',
      done: insuranceClaimed && donationClaimed,
      detail: !insuranceClaimed && !donationClaimed
        ? 'No insurance or donation expenses logged yet'
        : !insuranceClaimed
          ? 'No insurance expenses logged yet'
          : !donationClaimed
            ? 'No donation expenses logged yet'
            : undefined,
    },
  ];

  return items;
}

function formatAud(n: number): string {
  return '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

export function checklistCompletion(items: ChecklistItem[]): { done: number; total: number; pct: number } {
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

/** Convenience for callers that just want the FY string for "this EOFY". */
export function activeEofyFinancialYear(now: Date = new Date()): string {
  // Between Jan and June, EOFY refers to the FY containing today (ends 30 June).
  // From July onwards, it refers to the FY that just ended (so the lodgement
  // checklist is still useful).
  const fy = currentFinancialYear(now);
  if (now.getMonth() + 1 >= 7) {
    const startYear = Number(fy.split('-')[0]);
    return `${startYear - 1}-${startYear}`;
  }
  return fy;
}
