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
  // Default: GET returns empty expenses
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

describe('Tax Page', () => {
  it('renders the page header', async () => {
    render(<TaxPage />);
    expect(screen.getByText('Tax Health Check')).toBeInTheDocument();
  });

  it('fetches expenses on load', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/expenses?fy=2025-2026'));
  });

  it('shows loading spinner then empty state', async () => {
    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText(/No expenses yet/)).toBeInTheDocument());
  });

  it('shows expenses returned from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: '1', date: '2025-09-15', description: 'Office chair', amount: 450, category: 'Work from Home', financialYear: '2025-2026' }
      ],
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

  it('posts new expense to API', async () => {
    const user = userEvent.setup();
    // GET returns empty, POST returns new expense
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: '2', date: '2025-09-15', description: 'Desk', amount: 500, category: 'Work from Home', financialYear: '2025-2026' }) });

    render(<TaxPage />);
    await waitFor(() => expect(screen.getByText(/No expenses yet/)).toBeInTheDocument());

    await user.click(screen.getByText('Add Expense'));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2025-09-15' } });
    await user.type(screen.getByPlaceholderText('Description'), 'Desk');
    await user.type(screen.getByPlaceholderText('Amount'), '500');

    const submitBtn = screen.getAllByText('Add').find(el => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit')!;
    await user.click(submitBtn);

    await waitFor(() => expect(screen.getByText('Desk')).toBeInTheDocument());
  });

  it('renders financial year selector', async () => {
    render(<TaxPage />);
    expect(screen.getByDisplayValue('FY 2025-2026')).toBeInTheDocument();
  });
});
