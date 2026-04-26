import type { Liability, NetWorthSnapshot } from '@/lib/networth-types';

describe('liabilities-repo + networth-history-repo guest mode', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.setItem('fd_guest', '1');
  });
  afterAll(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('liabilities round-trip in guest store', async () => {
    const repo = await import('@/lib/liabilities-repo');
    expect(await repo.listLiabilities()).toEqual([]);

    const added = await repo.addLiability({
      name: 'ANZ home loan',
      kind: 'mortgage',
      currentBalance: 600_000,
      originalAmount: 800_000,
    });
    expect(added.id).toBeTruthy();

    await repo.updateLiability(added.id, { currentBalance: 590_000 });
    expect((await repo.listLiabilities())[0].currentBalance).toBe(590_000);

    await repo.deleteLiability(added.id);
    expect(await repo.listLiabilities()).toEqual([]);
  });

  it('networth-history round-trip in guest store', async () => {
    const repo = await import('@/lib/networth-history-repo');
    const snap: NetWorthSnapshot = {
      id: '2026-04',
      capturedAt: new Date().toISOString(),
      totalAssets: 1_000_000,
      totalLiabilities: 600_000,
      netWorth: 400_000,
      assetsByClass: { Property: 1_000_000 },
      liabilitiesByKind: { mortgage: 600_000 },
      netWorthByMember: { __joint: 400_000 },
      superValue: 0,
    };
    await repo.saveNetWorthSnapshot(snap);
    expect((await repo.listNetWorthHistory())[0].id).toBe('2026-04');

    // Save a second month so we can verify ordering.
    await repo.saveNetWorthSnapshot({ ...snap, id: '2026-03', netWorth: 380_000 });
    const list = await repo.listNetWorthHistory();
    expect(list.map(h => h.id)).toEqual(['2026-03', '2026-04']);

    // Idempotent merge: re-save same id replaces.
    await repo.saveNetWorthSnapshot({ ...snap, netWorth: 410_000 });
    const after = await repo.listNetWorthHistory();
    expect(after.find(h => h.id === '2026-04')?.netWorth).toBe(410_000);
  });
});

describe('liabilities-repo Firestore mode', () => {
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
      docs: [{ id: 'l1', data: () => ({ name: 'M', kind: 'mortgage', currentBalance: 100, originalAmount: 200 }) }],
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

    const repo = await import('@/lib/liabilities-repo');
    const list = await repo.listLiabilities();
    expect(list).toHaveLength(1);
    expect((list[0] as Liability).kind).toBe('mortgage');

    await repo.addLiability({ name: 'X', kind: 'other', currentBalance: 1, originalAmount: 1 });
    expect(setDoc).toHaveBeenCalledTimes(1);

    await repo.updateLiability('l1', { currentBalance: 99 });
    expect(updateDoc).toHaveBeenCalledTimes(1);

    await repo.deleteLiability('l1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('listLiabilities falls back to [] when getDocs throws', async () => {
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
    const { listLiabilities } = await import('@/lib/liabilities-repo');
    await expect(listLiabilities()).resolves.toEqual([]);
  });
});

describe('networth-history-repo Firestore mode', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof window !== 'undefined') window.localStorage.removeItem('fd_guest');
  });

  it('list orders by id and save uses setDoc with merge', async () => {
    const collection = jest.fn(() => ({}));
    const docFn = jest.fn(() => ({ id: '2026-04' }));
    const queryFn = jest.fn(() => ({}));
    const orderBy = jest.fn();
    const getDocs = jest.fn().mockResolvedValue({
      docs: [
        { id: '2026-03', data: () => ({ id: '2026-03', netWorth: 100 }) },
        { id: '2026-04', data: () => ({ id: '2026-04', netWorth: 110 }) },
      ],
    });
    const setDoc = jest.fn().mockResolvedValue(undefined);

    jest.doMock('firebase/firestore', () => ({
      collection, doc: docFn, query: queryFn, orderBy,
      getDocs, setDoc, updateDoc: jest.fn(), deleteDoc: jest.fn(), onSnapshot: jest.fn(),
    }));
    jest.doMock('@/lib/firebase', () => ({
      auth: { currentUser: { email: 'me@example.com' } },
      db: { __db: true },
      app: null,
      functions: null,
    }));

    const repo = await import('@/lib/networth-history-repo');
    const list = await repo.listNetWorthHistory();
    expect(list.map(h => h.id)).toEqual(['2026-03', '2026-04']);

    await repo.saveNetWorthSnapshot({
      id: '2026-04',
      capturedAt: new Date().toISOString(),
      totalAssets: 1, totalLiabilities: 0, netWorth: 1,
      assetsByClass: {}, liabilitiesByKind: {}, netWorthByMember: {}, superValue: 0,
    });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  it('list returns [] on error', async () => {
    jest.doMock('firebase/firestore', () => ({
      collection: jest.fn(() => ({})),
      doc: jest.fn(),
      query: jest.fn(() => ({})),
      orderBy: jest.fn(),
      getDocs: jest.fn().mockRejectedValue(new Error('boom')),
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
    const { listNetWorthHistory } = await import('@/lib/networth-history-repo');
    await expect(listNetWorthHistory()).resolves.toEqual([]);
  });
});
