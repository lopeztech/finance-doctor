import { render, screen, waitFor } from '@testing-library/react';
import type { Expense, Investment, FamilyMember } from '@/lib/types';

const mockListExpenses = jest.fn<Promise<Expense[]>, [string]>().mockResolvedValue([]);
const mockListInvestments = jest.fn<Promise<Investment[]>, []>().mockResolvedValue([]);
const mockListFamilyMembers = jest.fn<Promise<FamilyMember[]>, []>().mockResolvedValue([]);

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/expenses-repo', () => ({
  listExpenses: (fy: string) => mockListExpenses(fy),
}));

jest.mock('@/lib/investments-repo', () => ({
  listInvestments: () => mockListInvestments(),
}));

jest.mock('@/lib/family-members-repo', () => ({
  listFamilyMembers: () => mockListFamilyMembers(),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

import EofyPage from '@/app/eofy/page';
import EofyBanner from '@/components/eofy-banner';
import { isEofySeason } from '@/lib/eofy';

beforeEach(() => {
  mockListExpenses.mockClear().mockResolvedValue([]);
  mockListInvestments.mockClear().mockResolvedValue([]);
  mockListFamilyMembers.mockClear().mockResolvedValue([]);
});

describe('/eofy page (smoke)', () => {
  it('renders the page header', async () => {
    render(<EofyPage />);
    await waitFor(() => expect(screen.getByText(/EOFY checklist/)).toBeInTheDocument());
  });

  it('renders the countdown panel', async () => {
    render(<EofyPage />);
    await waitFor(() => expect(screen.getByText('Countdown')).toBeInTheDocument());
  });

  it('renders the checklist completion summary', async () => {
    render(<EofyPage />);
    await waitFor(() => expect(screen.getByText(/of \d+ complete/)).toBeInTheDocument());
  });
});

describe('EofyBanner', () => {
  it('only renders during EOFY season', () => {
    const { container } = render(<EofyBanner />);
    if (isEofySeason()) {
      expect(container.textContent).toMatch(/EOFY/);
    } else {
      expect(container.textContent).toBe('');
    }
  });
});
