import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import {
  DEFAULT_PREFERENCES,
  withDefaults,
  type UserPreferences,
} from '@/lib/user-preferences-types';

const make = (overrides: Partial<UserPreferences['display']> = {}): UserPreferences => ({
  ...DEFAULT_PREFERENCES,
  display: { ...DEFAULT_PREFERENCES.display, ...overrides },
});

describe('formatDate', () => {
  it('formats DD/MM/YYYY by default', () => {
    expect(formatDate('2026-04-26')).toBe('26/04/2026');
  });

  it('formats YYYY-MM-DD', () => {
    expect(formatDate('2026-04-26', make({ dateFormat: 'YYYY-MM-DD' }))).toBe('2026-04-26');
  });

  it('formats D MMM YYYY', () => {
    expect(formatDate('2026-04-26', make({ dateFormat: 'D MMM YYYY' }))).toBe('26 Apr 2026');
  });

  it('handles bad input safely', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('avoids UTC drift on YYYY-MM-DD strings', () => {
    // 1 Jan 2026 in any TZ should still come out as 01/01/2026.
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });
});

describe('formatCurrency', () => {
  it('uses the AU $ symbol by default with no decimals', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });

  it('respects the decimals option', () => {
    expect(formatCurrency(1234.5, undefined, { decimals: 2 })).toBe('$1,234.50');
  });

  it('renders negative amounts with a leading sign', () => {
    expect(formatCurrency(-42, undefined, { decimals: 0 })).toBe('-$42');
  });

  it('switches to AUD code display when configured', () => {
    expect(formatCurrency(1000, make({ currencyDisplay: 'code' }))).toBe('AUD 1,000');
  });

  it('handles non-numeric input gracefully', () => {
    expect(formatCurrency(undefined)).toBe('$0');
    expect(formatCurrency(NaN)).toBe('$0');
  });
});

describe('formatNumber', () => {
  it('formats integers with thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('respects decimals', () => {
    expect(formatNumber(0.5, undefined, 2)).toBe('0.50');
  });
});

describe('withDefaults', () => {
  it('fills missing sections from defaults', () => {
    const merged = withDefaults({});
    expect(merged.display.dateFormat).toBe('DD/MM/YYYY');
    expect(merged.privacy.aiAdviceEnabled).toBe(true);
    expect(merged.defaults.homepage).toBe('/');
  });

  it('preserves user values when present', () => {
    const merged = withDefaults({
      privacy: { aiAdviceEnabled: false, aiContextOptOut: true },
      defaults: { homepage: '/expenses', defaultFinancialYear: '2024-2025' },
    });
    expect(merged.privacy.aiAdviceEnabled).toBe(false);
    expect(merged.privacy.aiContextOptOut).toBe(true);
    expect(merged.defaults.homepage).toBe('/expenses');
    expect(merged.defaults.defaultFinancialYear).toBe('2024-2025');
    // Untouched section still defaulted.
    expect(merged.display.density).toBe('comfortable');
  });
});

// AI gate ---------------------------------------------------------------------

describe('AI kill switch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('streamTaxAdvice throws AiDisabledError when prefs disable AI', async () => {
    jest.doMock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: {} }));
    jest.doMock('@/lib/preferences-cache', () => ({
      isAiAdviceAllowed: () => false,
      isAiContextOptOut: () => false,
      getCachedPreferences: () => DEFAULT_PREFERENCES,
      setCachedPreferences: () => {},
    }));
    jest.doMock('@/lib/guest-store', () => ({ isGuest: () => false }));
    const { streamTaxAdvice, AiDisabledError } = await import('@/lib/functions-client');
    await expect(streamTaxAdvice({})).rejects.toBeInstanceOf(AiDisabledError);
  });

  it('fetchDashboardTips returns [] silently when AI is disabled', async () => {
    jest.doMock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: {} }));
    jest.doMock('@/lib/preferences-cache', () => ({
      isAiAdviceAllowed: () => false,
      isAiContextOptOut: () => false,
      getCachedPreferences: () => DEFAULT_PREFERENCES,
      setCachedPreferences: () => {},
    }));
    jest.doMock('@/lib/guest-store', () => ({ isGuest: () => false }));
    const { fetchDashboardTips } = await import('@/lib/functions-client');
    await expect(fetchDashboardTips()).resolves.toEqual([]);
  });
});
