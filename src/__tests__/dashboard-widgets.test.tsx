import { render, screen, waitFor } from '@testing-library/react';
import type { Budget } from '@/lib/budgets-types';
import type { Expense } from '@/lib/types';

const watchBudgetsCb: { fn?: (b: Budget[]) => void } = {};
const mockListExpenses = jest.fn<Promise<Expense[]>, [string]>();

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

beforeEach(() => {
  watchBudgetsCb.fn = undefined;
  mockListExpenses.mockReset().mockResolvedValue([]);
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

