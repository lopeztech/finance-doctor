import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({
  auth: null,
  db: null,
  app: null,
  functions: null,
}));

jest.mock('@/lib/expenses-repo', () => ({
  listExpenses: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/investments-repo', () => ({
  listInvestments: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/family-members-repo', () => ({
  listFamilyMembers: jest.fn().mockResolvedValue([]),
}));

import Dashboard from '@/app/page';

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

describe('Dashboard', () => {
  it('renders the page header', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('renders summary cards after loading', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Portfolio Value')).toBeInTheDocument());
    expect(screen.getByText('Tax Deductions YTD')).toBeInTheDocument();
  });

  it('renders Investment Health panel', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Investment Health')).toBeInTheDocument());
  });

  it('renders Tax Health panel', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Tax Health')).toBeInTheDocument());
  });

  it('links to /investments and /tax', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      const investLink = screen.getByText('Add Investments');
      expect(investLink.closest('a')).toHaveAttribute('href', '/investments');
    });
  });

  it('renders financial year selector', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByDisplayValue('FY 2025-2026')).toBeInTheDocument());
  });
});
