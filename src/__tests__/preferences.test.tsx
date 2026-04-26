import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import {
  DEFAULT_PREFERENCES,
  withDefaults,
  type UserPreferences,
} from '@/lib/user-preferences-types';
import {
  getCachedPreferences,
  isAiAdviceAllowed,
  isAiContextOptOut,
  setCachedPreferences,
} from '@/lib/preferences-cache';

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

  it('accepts Date instances', () => {
    expect(formatDate(new Date(2026, 0, 15))).toBe('15/01/2026');
  });

  it('accepts numeric timestamps', () => {
    expect(formatDate(new Date(2026, 0, 15).getTime())).toBe('15/01/2026');
  });

  it('returns empty for invalid Date instances', () => {
    expect(formatDate(new Date('totally-not-a-date'))).toBe('');
  });

  it('returns empty for non-finite timestamp numbers', () => {
    expect(formatDate(Number.NaN)).toBe('');
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

describe('preferences-cache', () => {
  afterEach(() => setCachedPreferences({ ...DEFAULT_PREFERENCES }));

  it('returns defaults until set', () => {
    expect(getCachedPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(isAiAdviceAllowed()).toBe(true);
    expect(isAiContextOptOut()).toBe(false);
  });

  it('reflects mutations made via setCachedPreferences', () => {
    setCachedPreferences({
      ...DEFAULT_PREFERENCES,
      privacy: { aiAdviceEnabled: false, aiContextOptOut: true },
    });
    expect(isAiAdviceAllowed()).toBe(false);
    expect(isAiContextOptOut()).toBe(true);
    expect(getCachedPreferences().privacy.aiAdviceEnabled).toBe(false);
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

// Guest store new helpers -----------------------------------------------------

describe('guest-store user preferences + notifications', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.setItem('fd_guest', '1');
  });
  afterAll(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('round-trips user preferences through the guest store', async () => {
    const guest = await import('@/lib/guest-store');
    expect(guest.getUserPreferences()).toBeUndefined();
    const next = {
      ...DEFAULT_PREFERENCES,
      defaults: { ...DEFAULT_PREFERENCES.defaults, homepage: '/expenses' as const },
    };
    guest.setUserPreferences(next);
    expect(guest.getUserPreferences()).toEqual(next);
  });

  it('guest-mode user-preferences-repo round-trip', async () => {
    jest.doMock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));
    const { getUserPreferences, saveUserPreferences } = await import('@/lib/user-preferences-repo');
    const next = {
      ...DEFAULT_PREFERENCES,
      privacy: { aiAdviceEnabled: false, aiContextOptOut: true },
    };
    await saveUserPreferences(next);
    const fetched = await getUserPreferences();
    expect(fetched.privacy.aiAdviceEnabled).toBe(false);
    expect(fetched.privacy.aiContextOptOut).toBe(true);
  });

  it('Firestore-mode repo reads via getDoc and writes via setDoc with merge', async () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
    const stored = {
      ...DEFAULT_PREFERENCES,
      defaults: { ...DEFAULT_PREFERENCES.defaults, homepage: '/tax' as const },
    };
    const getDoc = jest.fn().mockResolvedValue({ exists: () => true, data: () => stored });
    const setDoc = jest.fn().mockResolvedValue(undefined);
    const docFn = jest.fn(() => ({ /* DocumentReference shape */ } as object));

    jest.doMock('firebase/firestore', () => ({ doc: docFn, getDoc, setDoc }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { /* shape doesn't matter — passed straight to mocks */ },
      app: null,
      functions: null,
    }));

    const repo = await import('@/lib/user-preferences-repo');
    const fetched = await repo.getUserPreferences();
    expect(fetched.defaults.homepage).toBe('/tax');
    expect(getDoc).toHaveBeenCalledTimes(1);

    await repo.saveUserPreferences({ ...stored, display: { ...stored.display, density: 'compact' } });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  it('Firestore-mode getUserPreferences falls back to defaults when getDoc throws', async () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
    const getDoc = jest.fn().mockRejectedValue(new Error('permission-denied'));
    jest.doMock('firebase/firestore', () => ({ doc: jest.fn(), getDoc, setDoc: jest.fn() }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: {},
      app: null,
      functions: null,
    }));

    const { getUserPreferences } = await import('@/lib/user-preferences-repo');
    const fetched = await getUserPreferences();
    expect(fetched).toEqual(DEFAULT_PREFERENCES);
  });

  it('addNotification dedupes by id and markRead/markAllRead update readAt', async () => {
    const guest = await import('@/lib/guest-store');
    const a = guest.addNotification({ kind: 'system', title: 'A', body: 'first' });
    const b = guest.addNotification({ kind: 'system', title: 'B', body: 'second', dedupeId: 'pinned' });
    const dup = guest.addNotification({ kind: 'system', title: 'B-again', body: 'reattempt', dedupeId: 'pinned' });
    expect(b).toEqual(dup); // same instance returned
    expect(guest.listNotifications().filter(n => n.id === 'pinned')).toHaveLength(1);

    guest.markNotificationRead(a.id);
    expect(guest.listNotifications().find(n => n.id === a.id)?.readAt).toBeTruthy();

    guest.markAllNotificationsRead();
    expect(guest.listNotifications().every(n => n.readAt)).toBe(true);
  });

  it('round-trips notification preferences', async () => {
    const guest = await import('@/lib/guest-store');
    expect(guest.getNotificationPreferences()).toBeUndefined();
    const prefs = {
      perKind: { system: 'off' as const },
      quietHours: { enabled: true, startHHmm: '20:00', endHHmm: '06:00' },
    };
    guest.setNotificationPreferences(prefs);
    expect(guest.getNotificationPreferences()).toEqual(prefs);
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

  it.each([
    'streamInvestmentsAdvice',
    'streamExpensesAdvice',
    'reanalyseExpenses',
    'scanReceipt',
  ] as const)('%s also throws AiDisabledError when AI is disabled', async (fnName) => {
    jest.doMock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: {} }));
    jest.doMock('@/lib/preferences-cache', () => ({
      isAiAdviceAllowed: () => false,
      isAiContextOptOut: () => false,
      getCachedPreferences: () => DEFAULT_PREFERENCES,
      setCachedPreferences: () => {},
    }));
    jest.doMock('@/lib/guest-store', () => ({ isGuest: () => false }));
    const mod = await import('@/lib/functions-client');
    const fn = (mod as unknown as Record<string, (a: unknown, b?: unknown) => Promise<unknown>>)[fnName];
    // scanReceipt takes two args; the others take one. Both reject before
    // touching args because the gate runs first.
    await expect(fn({}, 'image/png')).rejects.toBeInstanceOf(mod.AiDisabledError);
  });
});
