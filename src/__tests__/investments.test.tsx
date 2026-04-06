import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentsPage from '@/app/investments/page';

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({
    settings: {},
    updateSettings: jest.fn(),
  }),
}));

describe('Investments Page', () => {
  it('renders the page header', () => {
    render(<InvestmentsPage />);
    expect(screen.getByText('Investment Health Check')).toBeInTheDocument();
  });

  it('renders summary cards with zero values initially', () => {
    render(<InvestmentsPage />);
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Asset Classes')).toBeInTheDocument();
    expect(screen.getByText('---')).toBeInTheDocument();
  });

  it('shows empty state message', () => {
    render(<InvestmentsPage />);
    expect(screen.getByText(/No investments yet/)).toBeInTheDocument();
  });

  it('shows type-specific fields for shares', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));

    // Default type is Australian Shares — should show units, buy price, current value
    expect(screen.getByPlaceholderText('Units')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buy price/unit')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Current total value')).toBeInTheDocument();
  });

  it('shows type-specific fields for property', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));
    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Property');

    expect(screen.getByPlaceholderText('Purchase price')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Current value')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rental income/yr')).toBeInTheDocument();
    // Should NOT show units
    expect(screen.queryByPlaceholderText('Units')).not.toBeInTheDocument();
  });

  it('shows type-specific fields for super', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));
    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Superannuation');

    expect(screen.getByPlaceholderText('Current balance')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Employer contrib %')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Units')).not.toBeInTheDocument();
  });

  it('shows type-specific fields for cash', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));
    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Cash / Term Deposit');

    expect(screen.getByPlaceholderText('Amount')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Interest rate %')).toBeInTheDocument();
  });

  it('adds a share investment and shows it in table', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));

    await user.type(screen.getByPlaceholderText(/CBA/), 'VAS');
    await user.type(screen.getByPlaceholderText('Units'), '100');
    await user.type(screen.getByPlaceholderText('Buy price/unit'), '90');
    await user.type(screen.getByPlaceholderText('Current total value'), '10000');

    const submitBtn = screen.getAllByText('Add').find(el => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit')!;
    await user.click(submitBtn);

    expect(screen.getByText('VAS')).toBeInTheDocument();
    expect(screen.getByText('100 units @ $90.00')).toBeInTheDocument();
  });

  it('adds a property investment with rental income', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));

    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Property');
    await user.type(screen.getByPlaceholderText(/Smith St/), 'Brisbane Unit');
    await user.type(screen.getByPlaceholderText('Purchase price'), '500000');
    await user.type(screen.getByPlaceholderText('Current value'), '550000');
    await user.type(screen.getByPlaceholderText('Rental income/yr'), '26000');

    const submitBtn = screen.getAllByText('Add').find(el => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit')!;
    await user.click(submitBtn);

    expect(screen.getByText('Brisbane Unit')).toBeInTheDocument();
    expect(screen.getByText('Rental: $26,000/yr')).toBeInTheDocument();
  });

  it('shows health assessment after adding investments', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));

    await user.type(screen.getByPlaceholderText(/CBA/), 'VAS');
    await user.type(screen.getByPlaceholderText('Units'), '100');
    await user.type(screen.getByPlaceholderText('Buy price/unit'), '90');
    await user.type(screen.getByPlaceholderText('Current total value'), '10000');

    const submitBtn = screen.getAllByText('Add').find(el => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit')!;
    await user.click(submitBtn);

    expect(screen.getByText('Investment Health Assessment')).toBeInTheDocument();
    expect(screen.getByText('Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Prescription')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
  });

  it('removes an investment', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await user.click(screen.getByText('Add Investment'));

    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), 'Cryptocurrency');
    await user.type(screen.getByPlaceholderText(/BTC/), 'BTC');
    await user.type(screen.getByPlaceholderText('Units'), '1');
    await user.type(screen.getByPlaceholderText('Buy price/unit'), '50000');
    await user.type(screen.getByPlaceholderText('Current total value'), '60000');

    const submitBtn = screen.getAllByText('Add').find(el => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit')!;
    await user.click(submitBtn);
    expect(screen.getByText('BTC')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const removeBtn = within(table).getAllByRole('button')[0];
    await user.click(removeBtn);
    expect(screen.queryByText('BTC')).not.toBeInTheDocument();
  });
});
