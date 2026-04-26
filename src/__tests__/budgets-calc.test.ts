import {
  computeProgress,
  monthKey,
  nextThresholdToAlert,
  previousMonth,
  rolloverInForMonth,
  spendForMonth,
} from '@/lib/budgets-calc';
import type { Budget } from '@/lib/budgets-types';
import type { Expense } from '@/lib/types';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e' + Math.random(),
  date: '2026-04-15',
  description: 'X',
  amount: 0,
  category: 'Other Deductions',
  financialYear: '2025-2026',
  ...overrides,
});

const groceries: Budget = {
  id: 'g',
  scope: 'spending-category',
  category: 'Groceries',
  amount: 800,
  period: 'monthly',
  startMonth: '2026-01',
  rolloverUnused: false,
  alertThresholds: [0.8, 1.0, 1.2],
};

describe('monthKey + previousMonth', () => {
  it('formats Date to YYYY-MM', () => {
    expect(monthKey(new Date(2026, 3, 26))).toBe('2026-04');
  });

  it('rolls over the year boundary', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('2026-04')).toBe('2026-03');
  });
});

describe('spendForMonth', () => {
  it('sums only expenses matching scope and month', () => {
    const expenses: Expense[] = [
      expense({ date: '2026-04-01', amount: 120, spendingCategory: 'Groceries' }),
      expense({ date: '2026-04-15', amount: 80, spendingCategory: 'Groceries' }),
      expense({ date: '2026-03-30', amount: 99, spendingCategory: 'Groceries' }), // wrong month
      expense({ date: '2026-04-15', amount: 50, spendingCategory: 'Cafe' }),       // wrong category
    ];
    expect(spendForMonth(groceries, expenses, '2026-04')).toBe(200);
  });

  it('overall scope counts every expense in the month', () => {
    const overall: Budget = { ...groceries, scope: 'overall', category: undefined };
    const expenses: Expense[] = [
      expense({ date: '2026-04-01', amount: 100, spendingCategory: 'Groceries' }),
      expense({ date: '2026-04-15', amount: 250, spendingCategory: 'Cafe' }),
      expense({ date: '2026-03-30', amount: 999 }), // out of month
    ];
    expect(spendForMonth(overall, expenses, '2026-04')).toBe(350);
  });

  it('sub-category scope filters to the exact pair', () => {
    const sub: Budget = {
      ...groceries,
      scope: 'spending-sub-category',
      subCategory: 'Coffee',
    };
    const expenses: Expense[] = [
      expense({ date: '2026-04-01', amount: 12, spendingCategory: 'Groceries', spendingSubCategory: 'Coffee' }),
      expense({ date: '2026-04-15', amount: 12, spendingCategory: 'Groceries', spendingSubCategory: 'Tea' }), // wrong sub
      expense({ date: '2026-04-15', amount: 12, spendingCategory: 'Cafe', spendingSubCategory: 'Coffee' }),    // wrong cat
    ];
    expect(spendForMonth(sub, expenses, '2026-04')).toBe(12);
  });

  it('ignores rows with missing date or non-numeric amount', () => {
    const expenses = [
      expense({ date: undefined as unknown as string, amount: 100 }),
      expense({ date: '2026-04-01', amount: NaN }),
      expense({ date: '2026-04-01', amount: 50, spendingCategory: 'Groceries' }),
    ];
    expect(spendForMonth(groceries, expenses, '2026-04')).toBe(50);
  });
});

describe('rollover', () => {
  it('returns 0 when rollover is disabled', () => {
    const expenses: Expense[] = [
      expense({ date: '2026-03-15', amount: 100, spendingCategory: 'Groceries' }),
    ];
    expect(rolloverInForMonth(groceries, expenses, '2026-04')).toBe(0);
  });

  it('rolls forward unspent budget when enabled', () => {
    const b: Budget = { ...groceries, rolloverUnused: true };
    const expenses: Expense[] = [
      expense({ date: '2026-03-15', amount: 500, spendingCategory: 'Groceries' }), // 300 unspent
    ];
    expect(rolloverInForMonth(b, expenses, '2026-04')).toBe(300);
  });

  it('caps rollover at 1× budget amount', () => {
    const b: Budget = { ...groceries, amount: 800, rolloverUnused: true };
    // Even with no spend, rollover is at most 800.
    const expenses: Expense[] = [];
    expect(rolloverInForMonth(b, expenses, '2026-04')).toBe(800);
  });

  it('returns 0 when previous month overspent (no negative carry)', () => {
    const b: Budget = { ...groceries, rolloverUnused: true };
    const expenses: Expense[] = [
      expense({ date: '2026-03-10', amount: 1100, spendingCategory: 'Groceries' }),
    ];
    expect(rolloverInForMonth(b, expenses, '2026-04')).toBe(0);
  });

  it('returns 0 in or before the budget start month', () => {
    const b: Budget = { ...groceries, rolloverUnused: true, startMonth: '2026-04' };
    expect(rolloverInForMonth(b, [], '2026-04')).toBe(0);
    expect(rolloverInForMonth(b, [], '2026-03')).toBe(0);
  });
});

describe('computeProgress', () => {
  it('classifies levels correctly and caps the visual ratio at 1.5', () => {
    const p1 = computeProgress(groceries, [expense({ amount: 100, spendingCategory: 'Groceries' })], '2026-04');
    expect(p1.level).toBe('green');

    const p2 = computeProgress(groceries, [expense({ amount: 700, spendingCategory: 'Groceries' })], '2026-04');
    expect(p2.level).toBe('amber');

    const p3 = computeProgress(groceries, [expense({ amount: 2000, spendingCategory: 'Groceries' })], '2026-04');
    expect(p3.level).toBe('red');
    expect(p3.ratio).toBe(1.5);
  });

  it('includes rollover in the effective cap', () => {
    const b: Budget = { ...groceries, rolloverUnused: true };
    const prevMonth = expense({ date: '2026-03-10', amount: 600, spendingCategory: 'Groceries' });
    const thisMonth = expense({ date: '2026-04-10', amount: 200, spendingCategory: 'Groceries' });
    const p = computeProgress(b, [prevMonth, thisMonth], '2026-04');
    expect(p.rolloverIn).toBe(200);
    expect(p.effectiveCap).toBe(1000);
    expect(p.spent).toBe(200);
    expect(p.level).toBe('green');
  });
});

describe('nextThresholdToAlert', () => {
  it('returns the highest crossed threshold on first eval', () => {
    expect(nextThresholdToAlert(groceries, 700, 800, '2026-04')).toBe(0.8);
    expect(nextThresholdToAlert(groceries, 800, 800, '2026-04')).toBe(1.0);
    expect(nextThresholdToAlert(groceries, 1000, 800, '2026-04')).toBe(1.2);
  });

  it('returns null when no threshold has been hit', () => {
    expect(nextThresholdToAlert(groceries, 100, 800, '2026-04')).toBeNull();
  });

  it('does not re-fire the same threshold within the same month', () => {
    const after80: Budget = {
      ...groceries,
      lastAlertedMonth: '2026-04',
      lastAlertedThreshold: 0.8,
    };
    expect(nextThresholdToAlert(after80, 700, 800, '2026-04')).toBeNull();
    expect(nextThresholdToAlert(after80, 800, 800, '2026-04')).toBe(1.0);
  });

  it('resets on a new month so 80% can fire again', () => {
    const lastMonth: Budget = {
      ...groceries,
      lastAlertedMonth: '2026-03',
      lastAlertedThreshold: 1.2,
    };
    expect(nextThresholdToAlert(lastMonth, 700, 800, '2026-04')).toBe(0.8);
  });

  it('honours custom thresholds and returns the highest crossed', () => {
    const tight: Budget = { ...groceries, alertThresholds: [0.5, 0.9] };
    expect(nextThresholdToAlert(tight, 480, 800, '2026-04')).toBe(0.5); // ratio 0.6 → only 0.5 crossed
    expect(nextThresholdToAlert(tight, 720, 800, '2026-04')).toBe(0.9); // ratio 0.9 → both crossed, return 0.9
  });

  it('falls back to the defaults when alertThresholds is empty', () => {
    const empty: Budget = { ...groceries, alertThresholds: [] };
    expect(nextThresholdToAlert(empty, 1000, 800, '2026-04')).toBe(1.2);
  });
});
