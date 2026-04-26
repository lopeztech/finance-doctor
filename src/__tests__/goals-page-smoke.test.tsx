import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Goal } from '@/lib/goals-types';
import type { Investment, Expense } from '@/lib/types';

const watchGoalsCb: { fn?: (g: Goal[]) => void } = {};
const mockListInvestments = jest.fn<Promise<Investment[]>, []>().mockResolvedValue([]);
const mockListExpenses = jest.fn<Promise<Expense[]>, [string]>().mockResolvedValue([]);
const mockAddGoal = jest.fn().mockResolvedValue({ id: 'new' });
const mockUpdateGoal = jest.fn().mockResolvedValue(undefined);
const mockDeleteGoal = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/goals-repo', () => ({
  watchGoals: (cb: (g: Goal[]) => void) => {
    watchGoalsCb.fn = cb;
    cb([]);
    return () => {};
  },
  addGoal: (...args: unknown[]) => mockAddGoal(...args),
  updateGoal: (...args: unknown[]) => mockUpdateGoal(...args),
  deleteGoal: (...args: unknown[]) => mockDeleteGoal(...args),
  listGoals: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/investments-repo', () => ({
  listInvestments: () => mockListInvestments(),
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

import GoalsPage from '@/app/goals/page';

beforeEach(() => {
  watchGoalsCb.fn = undefined;
  mockListInvestments.mockClear().mockResolvedValue([]);
  mockListExpenses.mockClear().mockResolvedValue([]);
  mockAddGoal.mockClear().mockResolvedValue({ id: 'new' });
  mockUpdateGoal.mockClear().mockResolvedValue(undefined);
  mockDeleteGoal.mockClear().mockResolvedValue(undefined);
});

describe('/goals page (smoke)', () => {
  it('renders the page header', async () => {
    render(<GoalsPage />);
    await waitFor(() => expect(screen.getByText('Savings Goals')).toBeInTheDocument());
  });

  it('exposes the New goal form button', async () => {
    render(<GoalsPage />);
    await screen.findByRole('button', { name: /Add goal/i });
  });

  it('renders an active goal delivered via the watcher', async () => {
    render(<GoalsPage />);
    await waitFor(() => expect(watchGoalsCb.fn).toBeTruthy());
    const goal: Goal = {
      id: 'g1',
      name: 'House deposit',
      category: 'house',
      targetAmount: 100000,
      linkedInvestments: [],
      startedAt: '2026-01-01T00:00:00Z',
      monthlyContribution: 3000,
    };
    watchGoalsCb.fn!([goal]);
    await waitFor(() => expect(screen.getByText('House deposit')).toBeInTheDocument());
  });

  it('rejects an unnamed goal submission', async () => {
    render(<GoalsPage />);
    const submit = await screen.findByRole('button', { name: /Add goal/i });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(screen.getByText(/Give the goal a name/i)).toBeInTheDocument(),
    );
    expect(mockAddGoal).not.toHaveBeenCalled();
  });

  it('toggles between active and archived views', async () => {
    render(<GoalsPage />);
    await waitFor(() => expect(watchGoalsCb.fn).toBeTruthy());
    watchGoalsCb.fn!([
      {
        id: 'a',
        name: 'Active',
        category: 'house',
        targetAmount: 100,
        linkedInvestments: [],
        startedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'z',
        name: 'Archived',
        category: 'holiday',
        targetAmount: 50,
        linkedInvestments: [],
        startedAt: '2026-01-01T00:00:00Z',
        archivedAt: '2026-04-01T00:00:00Z',
      },
    ]);
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View archived/i }));
    await waitFor(() => expect(screen.getByText('Archived')).toBeInTheDocument());
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });
});
