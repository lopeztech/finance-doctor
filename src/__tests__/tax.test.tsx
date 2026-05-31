import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

const mockListExpenses = jest.fn();
jest.mock('@/lib/expenses-repo', () => ({
  listExpenses: (fy?: string) => mockListExpenses(fy),
  updateExpense: jest.fn(),
}));

jest.mock('@/lib/family-members-repo', () => ({
  listFamilyMembers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/category-rules-repo', () => ({
  upsertCategoryRule: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/components/deductions-chart', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/yoy-chart',         () => ({ __esModule: true, default: () => null }));

import TaxPage from '@/app/tax/page';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/advice-chat')) {
      return Promise.resolve({ ok: true, json: async () => ({ history: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  mockListExpenses.mockReset().mockResolvedValue([]);
  window.localStorage.clear();
});

describe('Tax Page', () => {
  it('renders the page header', async () => {
    render(<TaxPage />);
    // Ledger: heading is inside the report, rendered after loading resolves
    await screen.findByRole('heading', { name: /Tax Advisor/i });
  });

  it('fetches expenses on load', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(mockListExpenses).toHaveBeenCalledWith('all'));
  });

  it('shows empty state message after loading with no expenses', async () => {
    render(<TaxPage />);
    await screen.findByRole('heading', { name: /Tax Advisor/i });
    // Ledger dek text mentions adding expenses
    expect(screen.getByText(/No expenses tracked/i)).toBeInTheDocument();
  });

  it('shows expenses grouped by category', async () => {
    mockListExpenses.mockResolvedValue([
      { id: '1', date: '2025-09-15', description: 'Office chair', amount: 450, category: 'Work from Home', financialYear: '2025-2026' },
      { id: '2', date: '2025-10-01', description: 'Desk lamp', amount: 80, category: 'Work from Home', financialYear: '2025-2026' },
    ]);
    render(<TaxPage />);
    // 'Work from Home' appears in both the breakdown dlist and itemised sections
    await waitFor(() => expect(screen.getAllByText('Work from Home').length).toBeGreaterThan(0));
  });

  it('renders Ledger vitals cells', async () => {
    render(<TaxPage />);
    await screen.findByRole('heading', { name: /Tax Advisor/i });
    // Ledger vitals: uppercase labels in .cell .k
    expect(screen.getByText(/Total deductions/i)).toBeInTheDocument();
    expect(screen.getByText(/Categories used/i)).toBeInTheDocument();
    expect(screen.getByText(/Uncategorised/i)).toBeInTheDocument();
  });

  it('shows the Dr Finance assessment block', async () => {
    render(<TaxPage />);
    await screen.findByRole('heading', { name: /Tax Advisor/i });
    // 'Dr Finance' can appear in multiple nodes (name + agg text) — check at least one exists
    expect(screen.getAllByText('Dr Finance').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Run assessment/i })).toBeInTheDocument();
  });
});
