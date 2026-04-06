import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentsPage from '@/app/investments/page';

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({
    settings: {},
    updateSettings: jest.fn(),
  }),
}));

async function addInvestment(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  units: string,
  buyPrice: string,
  currentValue: string,
  type?: string
) {
  await user.click(screen.getByText('Add Investment'));

  const form = screen.getByText('Add').closest('form')!;

  await user.type(screen.getByPlaceholderText('Name (e.g. VAS, CBA)'), name);
  if (type) {
    await user.selectOptions(screen.getByDisplayValue('Australian Shares'), type);
  }
  await user.type(screen.getByPlaceholderText('Units'), units);
  await user.type(screen.getByPlaceholderText('Buy price/unit'), buyPrice);
  await user.type(screen.getByPlaceholderText('Current value'), currentValue);

  await user.click(within(form).getByText('Add'));
}

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
    expect(screen.getByText('Portfolio Health')).toBeInTheDocument();
    expect(screen.getByText('---')).toBeInTheDocument();
  });

  it('shows empty state message', () => {
    render(<InvestmentsPage />);
    expect(screen.getByText(/No investments yet/)).toBeInTheDocument();
  });

  it('shows add investment form when button is clicked', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);

    await user.click(screen.getByText('Add Investment'));
    expect(screen.getByPlaceholderText('Name (e.g. VAS, CBA)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Units')).toBeInTheDocument();
  });

  it('adds an investment and updates portfolio', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);

    await addInvestment(user, 'VAS', '100', '90', '10000');

    expect(screen.getByText('VAS')).toBeInTheDocument();
  });

  it('removes an investment', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);

    await addInvestment(user, 'BTC', '1', '50000', '60000');
    expect(screen.getByText('BTC')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const removeBtn = within(table).getAllByRole('button')[0];
    await user.click(removeBtn);

    expect(screen.queryByText('BTC')).not.toBeInTheDocument();
  });

  it('shows health assessment after adding investments', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);

    await addInvestment(user, 'VGS', '50', '80', '5000', 'International Shares');

    expect(screen.getByText('Investment Health Assessment')).toBeInTheDocument();
    expect(screen.getByText('Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Prescription')).toBeInTheDocument();
  });

  it('shows asset allocation breakdown', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);

    await addInvestment(user, 'VAS', '100', '90', '10000');

    expect(screen.getByText('Asset Allocation')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('shows Needs Attention for concentrated portfolio', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);

    await addInvestment(user, 'VAS', '100', '90', '10000');

    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
  });
});
