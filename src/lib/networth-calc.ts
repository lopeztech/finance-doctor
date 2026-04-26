import type { Investment } from './types';
import type { Liability, LiabilityKind, NetWorthSnapshot } from './networth-types';

const JOINT_KEY = '__joint';

export interface NetWorthOptions {
  /** Drop superannuation values from totals when true. */
  excludeSuper?: boolean;
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetsByClass: Record<string, number>;
  liabilitiesByKind: Partial<Record<LiabilityKind, number>>;
  netWorthByMember: Record<string, number>;
  superValue: number;
}

function isSuper(inv: Investment): boolean {
  return inv.type === 'Superannuation';
}

/**
 * Compute the household net-worth roll-up. Per-member values split joint
 * liabilities across `__joint`. Caller decides if super counts via `opts`.
 */
export function computeNetWorth(
  investments: Investment[],
  liabilities: Liability[],
  opts: NetWorthOptions = {},
): NetWorthSummary {
  const assetsByClass: Record<string, number> = {};
  const liabilitiesByKind: Partial<Record<LiabilityKind, number>> = {};
  const netWorthByMember: Record<string, number> = {};

  let totalAssets = 0;
  let totalLiabilities = 0;
  let superValue = 0;

  for (const inv of investments) {
    if (typeof inv.currentValue !== 'number' || !Number.isFinite(inv.currentValue)) continue;
    if (isSuper(inv)) {
      superValue += inv.currentValue;
      if (opts.excludeSuper) continue;
    }
    totalAssets += inv.currentValue;
    assetsByClass[inv.type] = (assetsByClass[inv.type] || 0) + inv.currentValue;

    const ownerKey = inv.owner || JOINT_KEY;
    netWorthByMember[ownerKey] = (netWorthByMember[ownerKey] || 0) + inv.currentValue;
  }

  for (const liab of liabilities) {
    if (typeof liab.currentBalance !== 'number' || !Number.isFinite(liab.currentBalance)) continue;
    totalLiabilities += liab.currentBalance;
    liabilitiesByKind[liab.kind] = (liabilitiesByKind[liab.kind] || 0) + liab.currentBalance;
    const ownerKey = liab.owner || JOINT_KEY;
    netWorthByMember[ownerKey] = (netWorthByMember[ownerKey] || 0) - liab.currentBalance;
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assetsByClass,
    liabilitiesByKind,
    netWorthByMember,
    superValue,
  };
}

export interface DeltaSummary {
  current: number;
  previous: number;
  delta: number;
  pct: number;
}

/**
 * Compare two snapshots; falls back to zero when there's no previous snapshot.
 * `pct` is null-safe — returns 0 when previous is 0 to avoid Infinity.
 */
export function deltaVs(current: number, previous: number | null | undefined): DeltaSummary {
  const prev = typeof previous === 'number' && Number.isFinite(previous) ? previous : 0;
  const delta = current - prev;
  const pct = prev === 0 ? 0 : (delta / Math.abs(prev)) * 100;
  return { current, previous: prev, delta, pct };
}

/**
 * Derive the snapshot doc shape from a live summary plus a `YYYY-MM` key.
 */
export function snapshotFromSummary(month: string, summary: NetWorthSummary): NetWorthSnapshot {
  return {
    id: month,
    capturedAt: new Date().toISOString(),
    totalAssets: summary.totalAssets,
    totalLiabilities: summary.totalLiabilities,
    netWorth: summary.netWorth,
    assetsByClass: { ...summary.assetsByClass },
    liabilitiesByKind: { ...summary.liabilitiesByKind },
    netWorthByMember: { ...summary.netWorthByMember },
    superValue: summary.superValue,
  };
}

export const NET_WORTH_JOINT_KEY = JOINT_KEY;
