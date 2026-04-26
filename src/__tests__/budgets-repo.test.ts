import type { Budget } from '@/lib/budgets-types';

describe('budgets-repo guest mode', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.setItem('fd_guest', '1');
  });
  afterAll(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('round-trips through the guest store (add/list/update/delete)', async () => {
    const repo = await import('@/lib/budgets-repo');
    const initial = await repo.listBudgets();
    expect(initial).toEqual([]);

    const added = await repo.addBudget({
      scope: 'spending-category',
      category: 'Groceries',
      amount: 600,
      period: 'monthly',
      startMonth: '2026-04',
      rolloverUnused: false,
      alertThresholds: [0.8, 1, 1.2],
    });
    expect(added.id).toBeTruthy();

    const listed = await repo.listBudgets();
    expect(listed).toHaveLength(1);

    await repo.updateBudget(added.id, { amount: 700 });
    expect((await repo.listBudgets())[0].amount).toBe(700);

    await repo.deleteBudget(added.id);
    expect(await repo.listBudgets()).toEqual([]);
  });

  it('watchBudgets in guest mode delivers the current snapshot once', async () => {
    const repo = await import('@/lib/budgets-repo');
    await repo.addBudget({
      scope: 'overall',
      amount: 5000,
      period: 'monthly',
      startMonth: '2026-04',
      rolloverUnused: false,
      alertThresholds: [0.8, 1, 1.2],
    });
    const captured: Budget[][] = [];
    const off = repo.watchBudgets(b => captured.push(b));
    expect(captured).toHaveLength(1);
    expect(captured[0]).toHaveLength(1);
    off();
  });
});

describe('budgets-repo Firestore mode', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('list / add / update / delete use the right Firestore primitives', async () => {
    const collection = jest.fn(() => ({ collectionRef: true }));
    const docFn = jest.fn(() => ({ id: 'auto-id' }));
    const queryFn = jest.fn((c, ...rest) => ({ q: true, c, rest }));
    const orderBy = jest.fn(name => ({ orderBy: name }));
    const getDocs = jest.fn().mockResolvedValue({
      docs: [{ id: 'b1', data: () => ({ scope: 'overall', amount: 100 }) }],
    });
    const setDoc = jest.fn().mockResolvedValue(undefined);
    const updateDoc = jest.fn().mockResolvedValue(undefined);
    const deleteDoc = jest.fn().mockResolvedValue(undefined);
    const onSnapshot = jest.fn();

    jest.doMock('firebase/firestore', () => ({
      collection, doc: docFn, query: queryFn, orderBy,
      getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
    }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { __db: true },
      app: null,
      functions: null,
    }));

    const repo = await import('@/lib/budgets-repo');
    const list = await repo.listBudgets();
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(list).toEqual([{ id: 'b1', scope: 'overall', amount: 100 }]);

    await repo.addBudget({
      scope: 'overall',
      amount: 200,
      period: 'monthly',
      startMonth: '2026-04',
      rolloverUnused: false,
      alertThresholds: [0.8, 1, 1.2],
    });
    expect(setDoc).toHaveBeenCalledTimes(1);

    await repo.updateBudget('b1', { amount: 250 });
    expect(updateDoc).toHaveBeenCalledTimes(1);

    await repo.deleteBudget('b1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('watchBudgets subscribes via onSnapshot and emits []  on error', async () => {
    const collection = jest.fn(() => ({}));
    const queryFn = jest.fn(() => ({}));
    const orderBy = jest.fn();
    const onSnapshot = jest.fn((_q, _onNext, onErr) => {
      // simulate Firestore error path
      onErr(new Error('permission'));
      return () => {};
    });
    jest.doMock('firebase/firestore', () => ({
      collection, query: queryFn, orderBy, onSnapshot,
      doc: jest.fn(), getDocs: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(),
    }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { __db: true },
      app: null,
      functions: null,
    }));

    const repo = await import('@/lib/budgets-repo');
    const captured: Budget[][] = [];
    const off = repo.watchBudgets(b => captured.push(b));
    expect(captured).toEqual([[]]);
    expect(typeof off).toBe('function');
  });
});
