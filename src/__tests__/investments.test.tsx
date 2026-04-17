import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/firebase', () => ({
  auth: null,
  db: null,
  app: null,
  functions: null,
}));

import InvestmentsPage from '@/app/investments/page';

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

describe('Investments Page', () => {
  it('renders the page header', async () => {
    render(<InvestmentsPage />);
    expect(screen.getByText('Family Portfolio')).toBeInTheDocument();
  });

  it('fetches investments on load', async () => {
    render(<InvestmentsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/investments', expect.anything()));
  });

  it('shows empty state after loading', async () => {
    render(<InvestmentsPage />);
    await waitFor(() => expect(screen.getByText(/No investments yet/)).toBeInTheDocument());
  });

  it('shows investments from API', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/investments') && !url.includes('advice')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: '1', name: 'VAS', type: 'Australian Shares', currentValue: 10000, costBasis: 9000, units: 100, buyPricePerUnit: 90 }
          ],
        });
      }
      if (typeof url === 'string' && url.includes('/api/advice-chat')) {
        return Promise.resolve({ ok: true, json: async () => ({ history: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<InvestmentsPage />);
    await waitFor(() => expect(screen.getByText('VAS')).toBeInTheDocument());
  });

  it('shows type-specific fields for shares', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await waitFor(() => {});
    await user.click(screen.getByText('Add Investment'));
    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Buy price per unit')).toBeInTheDocument();
  });

  it('shows type-specific fields for property', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await waitFor(() => {});
    await user.click(screen.getByText('Add Investment'));
    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Property');
    expect(screen.getByText('Purchase price')).toBeInTheDocument();
    expect(screen.getByText('Rental income per year')).toBeInTheDocument();
    expect(screen.getByText('Property type')).toBeInTheDocument();
  });

  it('shows type-specific fields for super', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await waitFor(() => {});
    await user.click(screen.getByText('Add Investment'));
    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Superannuation');
    expect(screen.getByText('Current balance')).toBeInTheDocument();
    expect(screen.getByText('Employer contribution')).toBeInTheDocument();
  });

  it('shows health assessment panel with AI advice button', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/investments') && !url.includes('advice')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: '1', name: 'VAS', type: 'Australian Shares', currentValue: 10000, costBasis: 9000 }
          ],
        });
      }
      if (typeof url === 'string' && url.includes('/api/advice-chat')) {
        return Promise.resolve({ ok: true, json: async () => ({ history: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<InvestmentsPage />);
    await waitFor(() => expect(screen.getByText('VAS')).toBeInTheDocument());
    expect(screen.getByText('Investment Health Assessment')).toBeInTheDocument();
    expect(screen.getByText('Get AI Advice')).toBeInTheDocument();
  });
});
