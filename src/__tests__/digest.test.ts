import { computeDigest, renderDigestText } from '@/lib/digest';
import type { Budget } from '@/lib/budgets-types';
import type { Goal } from '@/lib/goals-types';
import type { Investment, Expense } from '@/lib/types';
import type { Liability, NetWorthSnapshot } from '@/lib/networth-types';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e' + Math.random(),
  date: '2026-04-26',
  description: 'X',
  amount: 0,
  category: 'Other Deductions',
  financialYear: '2025-2026',
  ...overrides,
});

const inv = (id: string, value: number, type = 'Australian Shares'): Investment => ({
  id, name: id, type, currentValue: value, costBasis: value,
});

describe('computeDigest', () => {
  const now = new Date('2026-04-26T10:00:00Z');

  it('aggregates spend in the period and reports top categories', () => {
    const expenses: Expense[] = [
      expense({ date: '2026-04-25', amount: 50, spendingCategory: 'Groceries' }),
      expense({ date: '2026-04-22', amount: 80, spendingCategory: 'Cafe' }),
      expense({ date: '2026-04-21', amount: 30, spendingCategory: 'Groceries' }),
      // Outside the weekly window (more than 7 days ago).
      expense({ date: '2026-04-01', amount: 9999, spendingCategory: 'Travel & Holidays' }),
    ];
    const payload = computeDigest({
      period: 'weekly',
      expenses,
      budgets: [],
      goals: [],
      investments: [],
      liabilities: [],
      netWorthHistory: [],
      now,
    });
    expect(payload.totalSpend).toBe(160);
    expect(payload.topCategories.map(t => t.category)).toEqual(['Groceries', 'Cafe']);
    expect(payload.asOf).toBe('2026-04-26');
  });

  it('surfaces budget breaches in the highlight when over cap', () => {
    const budgets: Budget[] = [
      {
        id: 'b1',
        scope: 'spending-category',
        category: 'Groceries',
        amount: 100,
        period: 'monthly',
        startMonth: '2026-04',
        rolloverUnused: false,
        alertThresholds: [0.8, 1, 1.2],
      },
    ];
    const expenses: Expense[] = [
      expense({ date: '2026-04-15', amount: 200, spendingCategory: 'Groceries' }),
    ];
    const payload = computeDigest({
      period: 'monthly',
      expenses,
      budgets,
      goals: [],
      investments: [],
      liabilities: [],
      netWorthHistory: [],
      now,
    });
    expect(payload.budgetBreaches).toHaveLength(1);
    expect(payload.budgetBreaches[0].name).toBe('Groceries');
    expect(payload.highlight).toMatch(/Groceries budget/);
  });

  it('reports goal progress and prefers goal-completed highlight when applicable', () => {
    const goals: Goal[] = [
      {
        id: 'g1', name: 'House',
        category: 'house', targetAmount: 1000,
        linkedInvestments: ['i1'],
        startedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const investments = [inv('i1', 1500)];
    const payload = computeDigest({
      period: 'monthly',
      expenses: [],
      budgets: [],
      goals,
      investments,
      liabilities: [],
      netWorthHistory: [],
      now,
    });
    expect(payload.goalProgress[0].fraction).toBe(1);
    expect(payload.highlight).toMatch(/House reached its target/);
  });

  it('uses the previous-month snapshot for net-worth delta on monthly digests', () => {
    const investments = [inv('i1', 1000)];
    const liabilities: Liability[] = [];
    const lastMonth: NetWorthSnapshot = {
      id: '2026-03',
      capturedAt: '2026-03-31',
      totalAssets: 800, totalLiabilities: 0, netWorth: 800,
      assetsByClass: {}, liabilitiesByKind: {}, netWorthByMember: {}, superValue: 0,
    };
    const payload = computeDigest({
      period: 'monthly',
      expenses: [],
      budgets: [],
      goals: [],
      investments,
      liabilities,
      netWorthHistory: [lastMonth],
      now,
    });
    expect(payload.netWorth).toBe(1000);
    expect(payload.netWorthDelta).toBe(200);
    expect(payload.highlight).toMatch(/up 200/);
  });

  it('falls back to a steady highlight when nothing notable changed', () => {
    const payload = computeDigest({
      period: 'monthly',
      expenses: [],
      budgets: [],
      goals: [],
      investments: [],
      liabilities: [],
      netWorthHistory: [],
      now,
    });
    expect(payload.highlight).toMatch(/Steady/);
  });
});

describe('renderDigestText', () => {
  it('renders a plaintext body with the highlight + section headers', () => {
    const text = renderDigestText({
      period: 'weekly',
      asOf: '2026-04-26',
      totalSpend: 100.5,
      topCategories: [{ category: 'Groceries', total: 60 }, { category: 'Cafe', total: 40.5 }],
      budgetBreaches: [{ name: 'Cafe', spent: 40, cap: 30, ratio: 1.33 }],
      goalProgress: [{ name: 'House', fraction: 0.42, remaining: 580 }],
      netWorth: 50000,
      netWorthDelta: 500,
      highlight: 'Cafe budget at 133% — review before month end.',
    });
    expect(text).toMatch(/weekly digest/);
    expect(text).toMatch(/Highlight: Cafe budget/);
    expect(text).toMatch(/- Groceries: \$60/);
    expect(text).toMatch(/- Cafe: \$40 \/ \$30 \(133%\)/);
    expect(text).toMatch(/- House: 42%/);
    expect(text).toMatch(/Net worth: \$50000/);
  });
});
