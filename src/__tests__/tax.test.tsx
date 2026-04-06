import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaxPage from '@/app/tax/page';

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({
    settings: {},
    updateSettings: jest.fn(),
  }),
}));

async function addExpense(user: ReturnType<typeof userEvent.setup>, description: string, amount: string, category?: string) {
  const formVisible = document.querySelector('input[type="date"]');
  if (!formVisible) {
    await user.click(screen.getByText('Add Expense'));
  }

  const dateInput = document.querySelector('input[type="date"]')!;
  fireEvent.change(dateInput, { target: { value: '2025-09-15' } });
  await user.type(screen.getByPlaceholderText('Description'), description);
  await user.type(screen.getByPlaceholderText('Amount'), amount);

  if (category) {
    await user.selectOptions(screen.getByDisplayValue('Work from Home'), category);
  }

  const submitBtn = screen.getAllByText('Add').find(el => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit')!;
  await user.click(submitBtn);
}

describe('Tax Page', () => {
  it('renders the page header', () => {
    render(<TaxPage />);
    expect(screen.getByText('Tax Health Check')).toBeInTheDocument();
  });

  it('renders summary cards with zero values initially', () => {
    render(<TaxPage />);
    expect(screen.getByText('Total Deductions')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Expenses Logged')).toBeInTheDocument();
  });

  it('renders financial year selector', () => {
    render(<TaxPage />);
    expect(screen.getByDisplayValue('FY 2025-2026')).toBeInTheDocument();
  });

  it('shows empty state message', () => {
    render(<TaxPage />);
    expect(screen.getByText(/No expenses yet/)).toBeInTheDocument();
  });

  it('shows add expense form when button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaxPage />);

    await user.click(screen.getByText('Add Expense'));
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Amount')).toBeInTheDocument();
  });

  it('adds an expense, shows assessment and category breakdown', async () => {
    const user = userEvent.setup();
    render(<TaxPage />);

    await addExpense(user, 'Office chair', '450');

    // Expense appears in table (amount shows in row + footer total)
    expect(screen.getByText('Office chair')).toBeInTheDocument();
    expect(screen.getAllByText('$450.00').length).toBeGreaterThanOrEqual(1);

    // Health assessment appears
    expect(screen.getByText('Tax Health Assessment')).toBeInTheDocument();
    expect(screen.getByText('Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Prescription')).toBeInTheDocument();

    // Category breakdown appears
    expect(screen.getByText('Deductions by Category')).toBeInTheDocument();
  });
});
