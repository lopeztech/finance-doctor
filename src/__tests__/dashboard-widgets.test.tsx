import { render, screen, waitFor } from '@testing-library/react';
import type { Budget } from '@/lib/budgets-types';
import type { Liability, NetWorthSnapshot } from '@/lib/networth-types';
import type { Investment, Expense } from '@/lib/types';

const watchBudgetsCb: { fn?: (b: Budget[]) => void } = {};
const mockListExpenses = jest.fn<Promise<Expense[]>, [string]>();
const mockListInvestments = jest.fn<Promise<Investment[]>, []>();
const mockListLiabilities = jest.fn<Promise<Liability[]>, []>();
const mockListHistory = jest.fn<Promise<NetWorthSnapshot[]>, []>();

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/budgets-repo', () => ({
  watchBudgets: (cb: (b: Budget[]) => void) => {
    watchBudgetsCb.fn = cb;
    cb([]);
    return () => {};
  },
}));

jest.mock('@/lib/expenses-repo', () => ({
  listExpenses: (fy: string) => mockListExpenses(fy),
}));

jest.mock('@/lib/investments-repo', () => ({
  listInvestments: () => mockListInvestments(),
}));

jest.mock('@/lib/liabilities-repo', () => ({
  listLiabilities: () => mockListLiabilities(),
}));

jest.mock('@/lib/networth-history-repo', () => ({
  listNetWorthHistory: () => mockListHistory(),
}));

jest.mock('@/lib/use-preferences', () => {
  const { DEFAULT_PREFERENCES } = jest.requireActual('@/lib/user-preferences-types');
  return {
    usePreferences: () => ({ prefs: DEFAULT_PREFERENCES, ready: true, update: jest.fn() }),
  };
});

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

import BudgetsWidget from '@/components/budgets-widget';
import NetWorthWidget from '@/components/networth-widget';

beforeEach(() => {
  watchBudgetsCb.fn = undefined;
  mockListExpenses.mockReset().mockResolvedValue([]);
  mockListInvestments.mockReset().mockResolvedValue([]);
  mockListLiabilities.mockReset().mockResolvedValue([]);
  mockListHistory.mockReset().mockResolvedValue([]);
});

describe('BudgetsWidget', () => {
  it('renders nothing when no budgets are configured', async () => {
    const { container } = render(<BudgetsWidget />);
    await waitFor(() => expect(mockListExpenses).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('renders the top 3 budgets sorted by ratio', async () => {
    render(<BudgetsWidget />);
    await waitFor(() => expect(watchBudgetsCb.fn).toBeTruthy());
    const budgets: Budget[] = [
      { id: 'a', scope: 'spending-category', category: 'Groceries', amount: 800, period: 'monthly', startMonth: '2026-01', rolloverUnused: false, alertThresholds: [0.8, 1, 1.2] },
      { id: 'b', scope: 'spending-category', category: 'Cafe', amount: 200, period: 'monthly', startMonth: '2026-01', rolloverUnused: false, alertThresholds: [0.8, 1, 1.2] },
    ];
    watchBudgetsCb.fn!(budgets);
    await waitFor(() => expect(screen.getByText('Budgets · top 3')).toBeInTheDocument());
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Cafe')).toBeInTheDocument();
  });
});

describe('NetWorthWidget', () => {
  it('renders nothing when nothing is tracked', async () => {
    const { container } = render(<NetWorthWidget />);
    await waitFor(() => expect(mockListInvestments).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('renders with investments + liabilities + history delta', async () => {
    mockListInvestments.mockResolvedValue([
      { id: 'i1', name: 'X', type: 'Australian Shares', currentValue: 100_000, costBasis: 80_000 },
    ]);
    mockListLiabilities.mockResolvedValue([
      { id: 'l1', name: 'CC', kind: 'credit-card', currentBalance: 5_000, originalAmount: 5_000 },
    ]);
    const lastMonthKey = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
    mockListHistory.mockResolvedValue([
      {
        id: lastMonthKey,
        capturedAt: new Date().toISOString(),
        totalAssets: 90_000, totalLiabilities: 5_000, netWorth: 85_000,
        assetsByClass: {}, liabilitiesByKind: {}, netWorthByMember: {}, superValue: 0,
      },
    ]);
    render(<NetWorthWidget />);
    await waitFor(() => expect(screen.getByText('Net worth')).toBeInTheDocument());
    expect(screen.getByText(/since /)).toBeInTheDocument();
  });
});
