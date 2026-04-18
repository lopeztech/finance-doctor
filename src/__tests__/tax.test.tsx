import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({
  auth: null,
  db: null,
  app: null,
  functions: null,
}));

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

jest.mock('@/components/deductions-chart', () => ({
  __esModule: true,
  default: () => null,
}));

import TaxPage from '@/app/tax/page';

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({ settings: {}, updateSettings: jest.fn() }),
}));

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
  mockListExpenses.mockReset();
  mockListExpenses.mockResolvedValue([]);
});

describe('Tax Page', () => {
  it('renders the page header', async () => {
    render(<TaxPage />);
    expect(screen.getByText('Tax Health Check')).toBeInTheDocument();
  });

  it('fetches expenses on load', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(mockListExpenses).toHaveBeenCalledWith('all'));
  });

  it('shows empty state after loading', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText(/No deductions found/)).toBeInTheDocument());
  });

  it('shows expenses grouped by category', async () => {
    mockListExpenses.mockResolvedValue([
      { id: '1', date: '2025-09-15', description: 'Office chair', amount: 450, category: 'Work from Home', financialYear: '2025-2026' },
      { id: '2', date: '2025-10-01', description: 'Desk lamp', amount: 80, category: 'Work from Home', financialYear: '2025-2026' },
    ]);
    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText('Work from Home')).toBeInTheDocument());
  });

  it('renders financial year selector', async () => {
    render(<TaxPage />);
    expect(screen.getByDisplayValue('All Years')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    render(<TaxPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Deductions')).toBeInTheDocument();
      expect(screen.getByText('Categories Used')).toBeInTheDocument();
      expect(screen.getByText('Uncategorised')).toBeInTheDocument();
    });
  });
});
