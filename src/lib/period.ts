/**
 * Period filter helpers.
 *
 * A `Period` is an inclusive YYYY-MM-DD date range, or `null` meaning "no
 * filter / all time". Dates are stored as YMD strings to avoid timezone drift —
 * lexicographic string compare is correct date compare in ISO format.
 */

export type Period = { fromYmd: string; toYmd: string } | null;

export type PresetId =
  | 'this-month'
  | 'last-3m'
  | 'last-6m'
  | 'ytd'
  | 'this-fy'
  | 'last-fy'
  | 'all'
  | 'custom';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Australian FY for a YYYY-MM-DD date: returns "YYYY-YYYY" e.g. "2024-2025". */
export function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

/** Current Australian FY string (e.g. "2025-2026"). */
export function currentFinancialYear(today: Date = new Date()): string {
  return getFinancialYear(ymd(today));
}

/** Convert "YYYY-YYYY" FY string to its date range (Jul 1 → Jun 30). */
export function fyToRange(fy: string): Period {
  const [startStr, endStr] = fy.split('-');
  const startYear = parseInt(startStr, 10);
  const endYear = parseInt(endStr, 10);
  if (!startYear || !endYear) return null;
  return { fromYmd: `${startYear}-07-01`, toYmd: `${endYear}-06-30` };
}

/** Resolve a preset id to a concrete date range against `today`. */
export function presetToRange(presetId: PresetId, today: Date = new Date()): Period {
  if (presetId === 'all' || presetId === 'custom') return null;
  const todayYmd = ymd(today);
  if (presetId === 'this-month') {
    return { fromYmd: ymd(startOfMonth(today)), toYmd: todayYmd };
  }
  if (presetId === 'last-3m') {
    return { fromYmd: ymd(addMonths(today, -2)), toYmd: todayYmd };
  }
  if (presetId === 'last-6m') {
    return { fromYmd: ymd(addMonths(today, -5)), toYmd: todayYmd };
  }
  if (presetId === 'ytd') {
    return { fromYmd: `${today.getFullYear()}-01-01`, toYmd: todayYmd };
  }
  if (presetId === 'this-fy') {
    return fyToRange(currentFinancialYear(today));
  }
  if (presetId === 'last-fy') {
    const cur = currentFinancialYear(today);
    const startYear = parseInt(cur.split('-')[0], 10);
    return fyToRange(`${startYear - 1}-${startYear}`);
  }
  return null;
}

/**
 * True when the YYYY-MM-DD date string falls within the (inclusive) period.
 * A `null` period means "no filter" and matches every date.
 */
export function dateInRange(date: string, period: Period): boolean {
  if (!period) return true;
  return date >= period.fromYmd && date <= period.toYmd;
}

const PRESET_LABELS: Record<PresetId, string> = {
  'this-month': 'This month',
  'last-3m': 'Last 3 months',
  'last-6m': 'Last 6 months',
  ytd: 'Year to date',
  'this-fy': 'This FY',
  'last-fy': 'Last FY',
  all: 'All time',
  custom: 'Custom range',
};

export function presetLabel(id: PresetId): string {
  return PRESET_LABELS[id];
}

/** Short label for an FY string. "2024-2025" → "2024–25". */
export function shortFyLabel(fy: string): string {
  const [a, b] = fy.split('-');
  if (!a || !b) return fy;
  return `${a}–${b.slice(2)}`;
}
