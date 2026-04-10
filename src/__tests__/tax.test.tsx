import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaxPage from '@/app/tax/page';

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({ settings: {}, updateSettings: jest.fn() }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  // Default: all fetches return empty arrays
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
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/expenses?fy=all'));
  });

  it('shows loading spinner then empty state', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText(/No expenses yet/)).toBeInTheDocument());
  });

  it('shows expenses returned from API', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/expenses?fy=')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: '1', date: '2025-09-15', description: 'Office chair', amount: 450, category: 'Work from Home', financialYear: '2025-2026' }
          ],
        });
      }
      if (typeof url === 'string' && url.includes('/api/advice-chat')) {
        return Promise.resolve({ ok: true, json: async () => ({ history: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText('Office chair')).toBeInTheDocument());
  });

  it('shows add expense form when button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaxPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    await user.click(screen.getByText('Add Expense'));
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
  });

  it('renders financial year selector', async () => {
    render(<TaxPage />);
    expect(screen.getByDisplayValue('All Years')).toBeInTheDocument();
  });
});
