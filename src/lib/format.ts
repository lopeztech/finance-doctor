import {
  DEFAULT_PREFERENCES,
  type CurrencyDisplay,
  type DateFormat,
  type NumberLocale,
  type UserPreferences,
} from './user-preferences-types';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  // string — accept YYYY-MM-DD without time so it doesn't shift to UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d : null;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDate(
  input: Date | string | number | null | undefined,
  prefs: Pick<UserPreferences, 'display'> = DEFAULT_PREFERENCES,
): string {
  const d = parseDate(input);
  if (!d) return '';
  return formatWithStyle(d, prefs.display.dateFormat);
}

function formatWithStyle(d: Date, style: DateFormat): string {
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  switch (style) {
    case 'YYYY-MM-DD':
      return `${year}-${pad(month)}-${pad(day)}`;
    case 'D MMM YYYY':
      return `${day} ${MONTH_SHORT[d.getMonth()]} ${year}`;
    case 'DD/MM/YYYY':
    default:
      return `${pad(day)}/${pad(month)}/${year}`;
  }
}

export interface CurrencyOptions {
  /** Default 0 — pass 2 for cents. */
  decimals?: number;
  /** Override the per-pref currency display. */
  display?: CurrencyDisplay;
}

const CURRENCY_SYMBOL: Record<NumberLocale, string> = {
  'en-AU': '$',
  'en-US': '$',
  'en-GB': '£',
};

export function formatCurrency(
  amount: number | null | undefined,
  prefs: Pick<UserPreferences, 'display'> = DEFAULT_PREFERENCES,
  opts: CurrencyOptions = {},
): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const decimals = opts.decimals ?? 0;
  const locale = prefs.display.numberLocale;
  const display = opts.display ?? prefs.display.currencyDisplay;
  const formatted = Math.abs(value).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = value < 0 ? '-' : '';
  if (display === 'code') {
    return `${sign}AUD ${formatted}`;
  }
  return `${sign}${CURRENCY_SYMBOL[locale]}${formatted}`;
}

/** Plain number formatter (no currency) — uses the pref locale. */
export function formatNumber(
  amount: number | null | undefined,
  prefs: Pick<UserPreferences, 'display'> = DEFAULT_PREFERENCES,
  decimals = 0,
): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return value.toLocaleString(prefs.display.numberLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
