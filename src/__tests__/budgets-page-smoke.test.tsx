import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Budget } from '@/lib/budgets-types';
import type { Expense } from '@/lib/types';

const watchBudgetsCb: { fn?: (b: Budget[]) => void } = {};
const mockListExpenses = jest.fn<Promise<Expense[]>, [string]>().mockResolvedValue([]);
const mockAddBudget = jest.fn().mockResolvedValue({ id: 'new', amount: 100 });
const mockUpdateBudget = jest.fn().mockResolvedValue(undefined);
const mockDeleteBudget = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/budgets-repo', () => ({
  watchBudgets: (cb: (b: Budget[]) => void) => {
    watchBudgetsCb.fn = cb;
    cb([]);
    return () => {};
  },
  addBudget: (...args: unknown[]) => mockAddBudget(...args),
  updateBudget: (...args: unknown[]) => mockUpdateBudget(...args),
  deleteBudget: (...args: unknown[]) => mockDeleteBudget(...args),
  listBudgets: jest.fn().mockResolvedValue([]),
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

import BudgetsPage from '@/app/budgets/page';

beforeEach(() => {
  watchBudgetsCb.fn = undefined;
  mockListExpenses.mockClear().mockResolvedValue([]);
  mockAddBudget.mockClear().mockResolvedValue({ id: 'new', amount: 100 });
});

describe('/budgets page (smoke)', () => {
  it('renders the page header', async () => {
    render(<BudgetsPage />);
    await waitFor(() => expect(screen.getByText('Budgets')).toBeInTheDocument());
  });

  it('renders the form action button so the new-budget panel mounts', async () => {
    render(<BudgetsPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Add budget/i })).toBeInTheDocument(),
    );
  });

  it('renders a budget delivered via the watcher', async () => {
    render(<BudgetsPage />);
    await waitFor(() => expect(watchBudgetsCb.fn).toBeTruthy());
    const budget: Budget = {
      id: 'g',
      scope: 'spending-category',
      category: 'Groceries',
      amount: 800,
      period: 'monthly',
      startMonth: '2026-01',
      rolloverUnused: true,
      alertThresholds: [0.8, 1.0, 1.2],
    };
    watchBudgetsCb.fn!([budget]);
    await waitFor(() => expect(screen.getByText('Groceries')).toBeInTheDocument());
    expect(screen.getByText('rollover')).toBeInTheDocument();
  });

  it('submits the default form (Groceries / $500) and calls addBudget', async () => {
    render(<BudgetsPage />);
    const submit = await screen.findByRole('button', { name: /Add budget/i });
    fireEvent.click(submit);
    await waitFor(() => expect(mockAddBudget).toHaveBeenCalledTimes(1));
    expect(mockAddBudget.mock.calls[0][0]).toMatchObject({
      scope: 'spending-category',
      category: 'Groceries',
      amount: 500,
    });
  });
});
