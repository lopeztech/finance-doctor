import {
  computeNetWorth,
  deltaVs,
  NET_WORTH_JOINT_KEY,
  snapshotFromSummary,
} from '@/lib/networth-calc';
import type { Liability } from '@/lib/networth-types';
import type { Investment } from '@/lib/types';

const inv = (overrides: Partial<Investment>): Investment => ({
  id: 'i' + Math.random(),
  name: 'X',
  type: 'Australian Shares',
  currentValue: 0,
  costBasis: 0,
  ...overrides,
});

const liab = (overrides: Partial<Liability>): Liability => ({
  id: 'l' + Math.random(),
  name: 'X',
  kind: 'mortgage',
  currentBalance: 0,
  originalAmount: 0,
  ...overrides,
});

describe('computeNetWorth', () => {
  it('rolls up assets and liabilities to a household total', () => {
    const investments = [
      inv({ type: 'Australian Shares', owner: 'a', currentValue: 50000 }),
      inv({ type: 'Property', owner: 'a', currentValue: 800000 }),
      inv({ type: 'Cash / Term Deposit', owner: 'b', currentValue: 25000 }),
    ];
    const liabilities = [
      liab({ kind: 'mortgage', owner: 'a', currentBalance: 600000 }),
      liab({ kind: 'credit-card', owner: 'b', currentBalance: 5000 }),
    ];
    const r = computeNetWorth(investments, liabilities);
    expect(r.totalAssets).toBe(875000);
    expect(r.totalLiabilities).toBe(605000);
    expect(r.netWorth).toBe(270000);
    expect(r.netWorthByMember.a).toBe(250000); // 50k + 800k - 600k
    expect(r.netWorthByMember.b).toBe(20000);  // 25k - 5k
  });

  it('uses the joint key for un-owned items and reconciles to total', () => {
    const investments = [
      inv({ type: 'Property', currentValue: 1_000_000 }), // joint
      inv({ type: 'ETFs', owner: 'a', currentValue: 100_000 }),
    ];
    const liabilities = [
      liab({ kind: 'mortgage', currentBalance: 700_000 }), // joint
    ];
    const r = computeNetWorth(investments, liabilities);
    expect(r.netWorthByMember[NET_WORTH_JOINT_KEY]).toBe(300_000); // 1M - 700k
    expect(r.netWorthByMember.a).toBe(100_000);
    const memberSum = Object.values(r.netWorthByMember).reduce((s, v) => s + v, 0);
    expect(memberSum).toBe(r.netWorth);
  });

  it('excludes super from totals when requested but still reports superValue', () => {
    const investments = [
      inv({ type: 'Superannuation', owner: 'a', currentValue: 200_000 }),
      inv({ type: 'Australian Shares', owner: 'a', currentValue: 50_000 }),
    ];
    const withSuper = computeNetWorth(investments, []);
    expect(withSuper.totalAssets).toBe(250_000);
    expect(withSuper.superValue).toBe(200_000);

    const noSuper = computeNetWorth(investments, [], { excludeSuper: true });
    expect(noSuper.totalAssets).toBe(50_000);
    expect(noSuper.superValue).toBe(200_000); // still reported
    expect(noSuper.netWorthByMember.a).toBe(50_000);
    expect(noSuper.assetsByClass.Superannuation).toBeUndefined();
  });

  it('skips entries with non-numeric values', () => {
    const investments = [
      inv({ type: 'Other', currentValue: NaN as unknown as number }),
      inv({ type: 'Other', currentValue: 100 }),
    ];
    const liabilities = [
      liab({ kind: 'other', currentBalance: undefined as unknown as number }),
      liab({ kind: 'other', currentBalance: 50 }),
    ];
    const r = computeNetWorth(investments, liabilities);
    expect(r.totalAssets).toBe(100);
    expect(r.totalLiabilities).toBe(50);
  });
});

describe('deltaVs', () => {
  it('reports positive deltas with non-zero base', () => {
    const d = deltaVs(110, 100);
    expect(d.delta).toBe(10);
    expect(d.pct).toBeCloseTo(10);
  });

  it('handles missing previous as zero base', () => {
    const d = deltaVs(50, undefined);
    expect(d.previous).toBe(0);
    expect(d.delta).toBe(50);
    expect(d.pct).toBe(0);
  });

  it('treats negative previous correctly (uses absolute value for pct)', () => {
    const d = deltaVs(0, -100);
    expect(d.delta).toBe(100);
    expect(d.pct).toBe(100);
  });
});

describe('snapshotFromSummary', () => {
  it('captures the summary into a snapshot doc', () => {
    const summary = computeNetWorth(
      [inv({ type: 'Property', currentValue: 500000 })],
      [liab({ kind: 'mortgage', currentBalance: 200000 })],
    );
    const snap = snapshotFromSummary('2026-04', summary);
    expect(snap.id).toBe('2026-04');
    expect(snap.netWorth).toBe(300000);
    expect(snap.assetsByClass.Property).toBe(500000);
    expect(snap.liabilitiesByKind.mortgage).toBe(200000);
    expect(snap.capturedAt).toMatch(/T/); // ISO 8601
  });
});
