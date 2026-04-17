import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({
  auth: null,
  db: null,
  app: null,
  functions: null,
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
});

describe('Tax Page', () => {
  it('renders the page header', async () => {
    render(<TaxPage />);
    expect(screen.getByText('Tax Health Check')).toBeInTheDocument();
  });

  it('fetches expenses on load', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/expenses?fy=all', expect.anything()));
  });

  it('shows empty state after loading', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText(/No deductions found/)).toBeInTheDocument());
  });

  it('shows expenses grouped by category', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/expenses')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: '1', date: '2025-09-15', description: 'Office chair', amount: 450, category: 'Work from Home', financialYear: '2025-2026' },
            { id: '2', date: '2025-10-01', description: 'Desk lamp', amount: 80, category: 'Work from Home', financialYear: '2025-2026' },
          ],
        });
      }
      if (typeof url === 'string' && url.includes('/api/advice-chat')) {
        return Promise.resolve({ ok: true, json: async () => ({ history: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
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
