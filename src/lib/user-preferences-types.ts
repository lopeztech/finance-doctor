export type DateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'D MMM YYYY';
export type NumberLocale = 'en-AU' | 'en-US' | 'en-GB';
export type CurrencyDisplay = 'symbol' | 'code';
export type Density = 'comfortable' | 'compact';
export type Homepage = '/' | '/expenses' | '/investments' | '/cashflow' | '/tax';

export interface DisplayPrefs {
  dateFormat: DateFormat;
  numberLocale: NumberLocale;
  currencyDisplay: CurrencyDisplay;
  density: Density;
}

export interface DefaultsPrefs {
  homepage: Homepage;
  /** 'current' resolves to the FY containing today; otherwise an explicit FY string like '2025-2026'. */
  defaultFinancialYear: 'current' | string;
  defaultMember?: string;
}

export interface PrivacyPrefs {
  /** Hard kill switch for all Gemini-backed features. */
  aiAdviceEnabled: boolean;
  /** When true, expense descriptions are stripped from prompts (categories + amounts only). */
  aiContextOptOut: boolean;
}

export interface UserPreferences {
  display: DisplayPrefs;
  defaults: DefaultsPrefs;
  privacy: PrivacyPrefs;
  /** Set on first completion of the wizard — kept on profile so onboarding can read it. */
  onboardedAt?: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  display: {
    dateFormat: 'DD/MM/YYYY',
    numberLocale: 'en-AU',
    currencyDisplay: 'symbol',
    density: 'comfortable',
  },
  defaults: {
    homepage: '/',
    defaultFinancialYear: 'current',
  },
  privacy: {
    aiAdviceEnabled: true,
    aiContextOptOut: false,
  },
};

export const HOMEPAGE_OPTIONS: { value: Homepage; label: string }[] = [
  { value: '/', label: 'Dashboard' },
  { value: '/cashflow', label: 'Cashflow' },
  { value: '/tax', label: 'Tax' },
  { value: '/expenses', label: 'Expenses' },
  { value: '/investments', label: 'Investments' },
];

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '31/12/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-12-31' },
  { value: 'D MMM YYYY', label: 'D MMM YYYY', example: '31 Dec 2026' },
];

export const NUMBER_LOCALE_OPTIONS: { value: NumberLocale; label: string; example: string }[] = [
  { value: 'en-AU', label: 'Australian (1,234.56)', example: '1,234.56' },
  { value: 'en-US', label: 'US (1,234.56)', example: '1,234.56' },
  { value: 'en-GB', label: 'UK (1,234.56)', example: '1,234.56' },
];

/** Merge a partial pref doc with defaults, leaving unknown fields untouched. */
export function withDefaults(partial: Partial<UserPreferences> | undefined): UserPreferences {
  return {
    display: { ...DEFAULT_PREFERENCES.display, ...(partial?.display || {}) },
    defaults: { ...DEFAULT_PREFERENCES.defaults, ...(partial?.defaults || {}) },
    privacy: { ...DEFAULT_PREFERENCES.privacy, ...(partial?.privacy || {}) },
    onboardedAt: partial?.onboardedAt,
  };
}
