import type { Goal } from '@/lib/goals-types';

describe('goals-repo guest mode', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.setItem('fd_guest', '1');
  });
  afterAll(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('round-trips through the guest store (add/list/update/delete)', async () => {
    const repo = await import('@/lib/goals-repo');
    expect(await repo.listGoals()).toEqual([]);

    const added = await repo.addGoal({
      name: 'House',
      category: 'house',
      targetAmount: 100000,
      linkedInvestments: [],
      startedAt: new Date().toISOString(),
    });
    expect(added.id).toBeTruthy();

    await repo.updateGoal(added.id, { targetAmount: 120000 });
    expect((await repo.listGoals())[0].targetAmount).toBe(120000);

    await repo.deleteGoal(added.id);
    expect(await repo.listGoals()).toEqual([]);
  });

  it('watchGoals delivers the current snapshot once', async () => {
    const repo = await import('@/lib/goals-repo');
    await repo.addGoal({
      name: 'Holiday',
      category: 'holiday',
      targetAmount: 5000,
      linkedInvestments: [],
      startedAt: new Date().toISOString(),
    });
    const captured: Goal[][] = [];
    const off = repo.watchGoals(g => captured.push(g));
    expect(captured).toHaveLength(1);
    expect(captured[0]).toHaveLength(1);
    off();
  });
});

describe('goals-repo Firestore mode', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('list/add/update/delete hit the expected primitives', async () => {
    const collection = jest.fn(() => ({}));
    const docFn = jest.fn(() => ({ id: 'auto-id' }));
    const queryFn = jest.fn(() => ({}));
    const orderBy = jest.fn();
    const getDocs = jest.fn().mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ name: 'House', category: 'house', targetAmount: 100, linkedInvestments: [], startedAt: '2026-01-01' }) }],
    });
    const setDoc = jest.fn().mockResolvedValue(undefined);
    const updateDoc = jest.fn().mockResolvedValue(undefined);
    const deleteDoc = jest.fn().mockResolvedValue(undefined);

    jest.doMock('firebase/firestore', () => ({
      collection, doc: docFn, query: queryFn, orderBy,
      getDocs, setDoc, updateDoc, deleteDoc, onSnapshot: jest.fn(),
    }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { __db: true },
      app: null,
      functions: null,
    }));

    const repo = await import('@/lib/goals-repo');
    const list = await repo.listGoals();
    expect(list).toHaveLength(1);

    await repo.addGoal({
      name: 'New',
      category: 'other',
      targetAmount: 200,
      linkedInvestments: [],
      startedAt: '2026-04-01',
    });
    expect(setDoc).toHaveBeenCalledTimes(1);

    await repo.updateGoal('g1', { targetAmount: 999 });
    expect(updateDoc).toHaveBeenCalledTimes(1);

    await repo.deleteGoal('g1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('listGoals returns [] when getDocs throws', async () => {
    jest.doMock('firebase/firestore', () => ({
      collection: jest.fn(() => ({})),
      doc: jest.fn(),
      query: jest.fn(() => ({})),
      orderBy: jest.fn(),
      getDocs: jest.fn().mockRejectedValue(new Error('permission')),
      setDoc: jest.fn(),
      updateDoc: jest.fn(),
      deleteDoc: jest.fn(),
      onSnapshot: jest.fn(),
    }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { __db: true },
      app: null,
      functions: null,
    }));
    const { listGoals } = await import('@/lib/goals-repo');
    await expect(listGoals()).resolves.toEqual([]);
  });

  it('watchGoals delivers [] when Firestore errors', async () => {
    const onSnapshot = jest.fn((_q, _onNext, onErr) => {
      onErr(new Error('boom'));
      return () => {};
    });
    jest.doMock('firebase/firestore', () => ({
      collection: jest.fn(() => ({})),
      doc: jest.fn(),
      query: jest.fn(() => ({})),
      orderBy: jest.fn(),
      getDocs: jest.fn(),
      setDoc: jest.fn(),
      updateDoc: jest.fn(),
      deleteDoc: jest.fn(),
      onSnapshot,
    }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { __db: true },
      app: null,
      functions: null,
    }));
    const repo = await import('@/lib/goals-repo');
    const captured: Goal[][] = [];
    const off = repo.watchGoals(g => captured.push(g));
    expect(captured).toEqual([[]]);
    expect(typeof off).toBe('function');
  });
});
