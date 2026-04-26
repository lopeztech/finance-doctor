import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Liability, NetWorthSnapshot } from '@/lib/networth-types';
import type { Investment, FamilyMember } from '@/lib/types';

const mockListInvestments = jest.fn<Promise<Investment[]>, []>();
const mockListLiabilities = jest.fn<Promise<Liability[]>, []>();
const mockListFamilyMembers = jest.fn<Promise<FamilyMember[]>, []>();
const mockListHistory = jest.fn<Promise<NetWorthSnapshot[]>, []>();
const mockAddLiability = jest.fn();
const mockSaveSnapshot = jest.fn();

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/investments-repo', () => ({ listInvestments: () => mockListInvestments() }));
jest.mock('@/lib/liabilities-repo', () => ({
  listLiabilities: () => mockListLiabilities(),
  addLiability: (...args: unknown[]) => mockAddLiability(...args),
  updateLiability: jest.fn(),
  deleteLiability: jest.fn(),
}));
jest.mock('@/lib/family-members-repo', () => ({ listFamilyMembers: () => mockListFamilyMembers() }));
jest.mock('@/lib/networth-history-repo', () => ({
  listNetWorthHistory: () => mockListHistory(),
  saveNetWorthSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
}));
jest.mock('@/lib/use-preferences', () => {
  const { DEFAULT_PREFERENCES } = jest.requireActual('@/lib/user-preferences-types');
  return {
    usePreferences: () => ({ prefs: DEFAULT_PREFERENCES, ready: true, update: jest.fn() }),
  };
});

import NetWorthPage from '@/app/net-worth/page';

beforeEach(() => {
  mockListInvestments.mockReset().mockResolvedValue([]);
  mockListLiabilities.mockReset().mockResolvedValue([]);
  mockListFamilyMembers.mockReset().mockResolvedValue([]);
  mockListHistory.mockReset().mockResolvedValue([]);
  mockAddLiability.mockReset().mockResolvedValue({ id: 'new' });
  mockSaveSnapshot.mockReset().mockResolvedValue(undefined);
});

describe('/net-worth page (smoke)', () => {
  it('renders the page header', async () => {
    render(<NetWorthPage />);
    await waitFor(() => expect(screen.getByText('Net Worth')).toBeInTheDocument());
  });

  it('exposes the Save snapshot and Add liability buttons', async () => {
    render(<NetWorthPage />);
    await screen.findByRole('button', { name: /Save snapshot/i });
    await screen.findByRole('button', { name: /Add liability/i });
  });

  it('triggers saveNetWorthSnapshot on click', async () => {
    render(<NetWorthPage />);
    const button = await screen.findByRole('button', { name: /Save snapshot/i });
    fireEvent.click(button);
    await waitFor(() => expect(mockSaveSnapshot).toHaveBeenCalledTimes(1));
  });

  it('rejects an unnamed liability submission', async () => {
    render(<NetWorthPage />);
    const submit = await screen.findByRole('button', { name: /Add liability/i });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(screen.getByText(/Give the liability a name/i)).toBeInTheDocument(),
    );
    expect(mockAddLiability).not.toHaveBeenCalled();
  });

  it('summarises members + assets when data is provided', async () => {
    mockListInvestments.mockResolvedValue([
      { id: 'i1', name: 'CBA', type: 'Australian Shares', currentValue: 50000, costBasis: 40000, owner: 'm1' },
      { id: 'i2', name: 'Home', type: 'Property', currentValue: 800000, costBasis: 800000 },
    ]);
    mockListLiabilities.mockResolvedValue([
      { id: 'l1', name: 'ANZ', kind: 'mortgage', currentBalance: 600000, originalAmount: 800000 },
    ]);
    mockListFamilyMembers.mockResolvedValue([{ id: 'm1', name: 'Alex', salary: 100000 }]);

    render(<NetWorthPage />);
    // Alex appears in the per-member breakdown and as an owner option in the
    // form, so just assert there's at least one match.
    await waitFor(() => expect(screen.getAllByText('Alex').length).toBeGreaterThan(0));
    expect(screen.getByText('ANZ')).toBeInTheDocument();
  });
});
