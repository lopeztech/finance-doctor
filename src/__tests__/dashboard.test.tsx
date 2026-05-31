import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/expenses-repo',       () => ({ listExpenses: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/investments-repo',    () => ({ listInvestments: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/family-members-repo', () => ({ listFamilyMembers: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/liabilities-repo',    () => ({
  listLiabilities: jest.fn().mockResolvedValue([]),
  addLiability: jest.fn(), updateLiability: jest.fn(), deleteLiability: jest.fn(),
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
  mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => [] });
});

describe('Net Worth (root) page', () => {
  it('renders the page header', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('heading', { name: /Financial Advisor/i });
  });

  it('renders the Vitals section with net-worth display', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('heading', { name: /Financial Advisor/i });
    // Ledger: section 01 is "Vitals" with a Save snapshot button
    expect(screen.getByRole('button', { name: /Save snapshot/i })).toBeInTheDocument();
  });

  it('renders Ledger vitals ledger cells', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('heading', { name: /Financial Advisor/i });
    // "Liabilities" appears in both the vitals cell and the details subhead — use getAllByText
    expect(screen.getAllByText(/Liabilities/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Assets/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Super held/i)).toBeInTheDocument();
  });

  it('renders the Prescriptions section', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('heading', { name: /Prescriptions/i });
  });

  it('renders the FY picker buttons', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('heading', { name: /Financial Advisor/i });
    // Ledger: FY picker uses abbreviated labels
    expect(screen.getByRole('button', { name: /FY 25/i })).toBeInTheDocument();
  });

  it('renders the Add liability form', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('button', { name: /Add liability/i });
  });

  it('renders the Details section', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('heading', { name: /Details/i });
  });
});
