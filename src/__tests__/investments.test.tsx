import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/firebase', () => ({
  auth: null, db: null, app: null, functions: null,
}));

// Charts not needed for these smoke tests
jest.mock('@/components/allocation-chart', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/investment-charts', () => ({
  __esModule: true,
  CostVsValueChart: () => null, GainLossChart: () => null,
  OwnerAllocationChart: () => null, ReturnByTypeChart: () => null,
}));

const mockListInvestments = jest.fn();
jest.mock('@/lib/investments-repo', () => ({
  listInvestments: () => mockListInvestments(),
  addInvestment: jest.fn(),
  updateInvestment: jest.fn(),
  deleteInvestment: jest.fn(),
}));

jest.mock('@/lib/family-members-repo', () => ({
  listFamilyMembers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/expenses-repo', () => ({
  listExpenses: jest.fn().mockResolvedValue([]),
  updateExpense: jest.fn(),
}));

import InvestmentsPage from '@/app/investments/page';

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
  mockListInvestments.mockReset();
  mockListInvestments.mockResolvedValue([]);
  window.localStorage.clear();
});

describe('Investments Page', () => {
  it('renders the page header', async () => {
    render(<InvestmentsPage />);
    // Ledger: heading is inside the report, rendered after loading resolves
    await screen.findByRole('heading', { name: /Investment Portfolio/i });
  });

  it('fetches investments on load', async () => {
    render(<InvestmentsPage />);
    await waitFor(() => expect(mockListInvestments).toHaveBeenCalled());
  });

  it('shows empty state after loading', async () => {
    render(<InvestmentsPage />);
    // Open the add form to see the empty holdings state
    const addBtn = await screen.findByRole('button', { name: /Add holding/i });
    expect(addBtn).toBeInTheDocument();
    // Empty state message in the holdings section
    await waitFor(() => expect(screen.getByText(/No holdings yet/i)).toBeInTheDocument());
  });

  it('shows investments from API', async () => {
    mockListInvestments.mockResolvedValue([
      { id: '1', name: 'VAS', type: 'Australian Shares', currentValue: 10000, costBasis: 9000, units: 100, buyPricePerUnit: 90 },
    ]);
    render(<InvestmentsPage />);
    // VAS appears in both the holdings table and the movers section
    await waitFor(() => expect(screen.getAllByText('VAS').length).toBeGreaterThan(0));
  });

  it('shows the add holding form when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    const addBtn = await screen.findByRole('button', { name: /Add holding/i });
    await user.click(addBtn);
    // Form should be visible with a type selector
    expect(screen.getByDisplayValue('Australian Shares')).toBeInTheDocument();
  });

  it('shows type-specific fields for shares when form is open', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    const addBtn = await screen.findByRole('button', { name: /Add holding/i });
    await user.click(addBtn);
    // Form should show the type select
    expect(screen.getByDisplayValue('Australian Shares')).toBeInTheDocument();
    // Name field should be visible
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('shows the diagnosis section with run assessment button', async () => {
    mockListInvestments.mockResolvedValue([
      { id: '1', name: 'VAS', type: 'Australian Shares', currentValue: 10000, costBasis: 9000 },
    ]);
    render(<InvestmentsPage />);
    await screen.findByRole('heading', { name: /Investment Portfolio/i });
    // Ledger: Dr Finance assess block always shows
    expect(screen.getByText('Dr Finance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run assessment/i })).toBeInTheDocument();
  });
});
