export type LiabilityKind =
  | 'mortgage'
  | 'personal-loan'
  | 'car-loan'
  | 'student-loan'
  | 'credit-card'
  | 'other';

export interface Liability {
  id: string;
  name: string;
  kind: LiabilityKind;
  /** Family member id; null/undefined means a joint liability. */
  owner?: string;
  currentBalance: number;
  originalAmount: number;
  interestRate?: number;
  minMonthlyPayment?: number;
  /** Investment id this is collateralised against (e.g. mortgage → property). */
  linkedAssetId?: string;
}

/** A single point on the net-worth trend line, persisted per month. */
export interface NetWorthSnapshot {
  /** Doc id is the YYYY-MM key. */
  id: string;
  capturedAt: string; // ISO 8601
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  /** sum of currentValue per investment.type, e.g. { 'Property': 850000, ... } */
  assetsByClass: Record<string, number>;
  /** sum of currentBalance per liability.kind */
  liabilitiesByKind: Partial<Record<LiabilityKind, number>>;
  /** Per-owner breakdown. Key is family-member id, plus '__joint' for un-owned. */
  netWorthByMember: Record<string, number>;
  superValue: number;
}

export const LIABILITY_KIND_LABEL: Record<LiabilityKind, string> = {
  'mortgage': 'Mortgage',
  'personal-loan': 'Personal loan',
  'car-loan': 'Car loan',
  'student-loan': 'Student loan',
  'credit-card': 'Credit card',
  'other': 'Other',
};

export const LIABILITY_KIND_ICON: Record<LiabilityKind, string> = {
  'mortgage': 'fa-house',
  'personal-loan': 'fa-hand-holding-dollar',
  'car-loan': 'fa-car',
  'student-loan': 'fa-graduation-cap',
  'credit-card': 'fa-credit-card',
  'other': 'fa-circle-question',
};
