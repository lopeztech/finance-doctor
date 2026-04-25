import { httpsCallable } from 'firebase/functions';

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  functions: {},
}));

const guestState = { isGuest: false };
jest.mock('@/lib/guest-store', () => ({
  isGuest: () => guestState.isGuest,
  getAdviceChat: jest.fn(),
  setAdviceChat: jest.fn(),
}));

jest.mock('@/lib/guest-mocks', () => ({
  GUEST_DASHBOARD_TIPS: [],
  mockTaxAdviceStream: jest.fn(),
  mockInvestmentsAdviceStream: jest.fn(),
  mockExpensesAdviceStream: jest.fn(),
}));

const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;

describe('scanReceipt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    guestState.isGuest = false;
  });

  it('rejects in guest mode', async () => {
    const { scanReceipt } = await import('@/lib/functions-client');
    guestState.isGuest = true;
    await expect(scanReceipt('abc', 'image/jpeg')).rejects.toThrow(/Guest mode/);
    expect(mockedHttpsCallable).not.toHaveBeenCalled();
  });

  it('calls expensesReceiptScan and returns the parsed result', async () => {
    const fn = jest.fn().mockResolvedValue({
      data: {
        date: '2025-04-01',
        amount: 12.34,
        description: 'Coles — Groceries',
        merchant: 'Coles',
        category: 'Other Deductions',
        spendingCategory: 'Groceries',
        confidence: 'high',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedHttpsCallable.mockReturnValue(fn as any);

    const { scanReceipt } = await import('@/lib/functions-client');
    const res = await scanReceipt('base64data', 'image/png');

    expect(mockedHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'expensesReceiptScan');
    expect(fn).toHaveBeenCalledWith({ imageBase64: 'base64data', mimeType: 'image/png' });
    expect(res.amount).toBe(12.34);
    expect(res.spendingCategory).toBe('Groceries');
    expect(res.confidence).toBe('high');
  });

  it('propagates errors from the callable', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedHttpsCallable.mockReturnValue(fn as any);

    const { scanReceipt } = await import('@/lib/functions-client');
    await expect(scanReceipt('img', 'image/jpeg')).rejects.toThrow('boom');
  });
});
