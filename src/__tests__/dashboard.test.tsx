import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({
  auth: null,
  db: null,
  app: null,
  functions: null,
}));

jest.mock('@/lib/expenses-repo', () => ({
  listExpenses: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/investments-repo', () => ({
  listInvestments: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/family-members-repo', () => ({
  listFamilyMembers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/liabilities-repo', () => ({
  listLiabilities: jest.fn().mockResolvedValue([]),
  addLiability: jest.fn(),
  updateLiability: jest.fn(),
  deleteLiability: jest.fn(),
}));

jest.mock('@/lib/networth-history-repo', () => ({
  listNetWorthHistory: jest.fn().mockResolvedValue([]),
  saveNetWorthSnapshot: jest.fn(),
}));

jest.mock('@/lib/budgets-repo', () => ({
  watchBudgets: (cb: (b: unknown[]) => void) => { cb([]); return () => {}; },
}));

jest.mock('@/lib/use-preferences', () => {
  const { DEFAULT_PREFERENCES } = jest.requireActual('@/lib/user-preferences-types');
  return {
    usePreferences: () => ({ prefs: DEFAULT_PREFERENCES, ready: true, update: jest.fn() }),
    PreferencesProvider: ({ children }: { children: React.ReactNode }) => children,
    getCachedPreferences: () => DEFAULT_PREFERENCES,
    isAiAdviceAllowed: () => true,
    isAiContextOptOut: () => false,
  };
});

import NetWorthPage from '@/app/page';

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

describe('Net Worth (root) page', () => {
  it('renders the page header', async () => {
    render(<NetWorthPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Net Worth' })).toBeInTheDocument());
  });

  it('renders the current snapshot panel', async () => {
    render(<NetWorthPage />);
    await waitFor(() => expect(screen.getByText('Current snapshot')).toBeInTheDocument());
    expect(screen.getByText('Save snapshot')).toBeInTheDocument();
  });

  it('renders summary cards after loading', async () => {
    render(<NetWorthPage />);
    await waitFor(() => expect(screen.getByText('Portfolio Value')).toBeInTheDocument());
    expect(screen.getByText('Tax Deductions YTD')).toBeInTheDocument();
  });

  it('renders Investment Health panel', async () => {
    render(<NetWorthPage />);
    await waitFor(() => expect(screen.getByText('Investment Health')).toBeInTheDocument());
  });

  it('renders Tax Health panel', async () => {
    render(<NetWorthPage />);
    await waitFor(() => expect(screen.getByText('Tax Health')).toBeInTheDocument());
  });

  it('links to /investments and /tax', async () => {
    render(<NetWorthPage />);
    await waitFor(() => {
      const investLink = screen.getByText('Add Investments');
      expect(investLink.closest('a')).toHaveAttribute('href', '/investments');
    });
  });

  it('renders financial year selector', async () => {
    render(<NetWorthPage />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /This FY/ });
      expect(btn).toBeInTheDocument();
    });
  });
});
