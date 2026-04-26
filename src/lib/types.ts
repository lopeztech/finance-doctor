export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  financialYear: string;
  owner?: string;
  nonDeductible?: boolean;
  recurrenceGroupId?: string;
  investmentId?: string;
  categorisationStatus?: 'pending' | 'done' | 'failed';
  categorisationError?: string;
}

export type EmploymentType = 'full-time' | 'part-time';

export interface FamilyMember {
  id: string;
  name: string;
  salary: number;
  job?: string;
  superSalarySacrifice?: number;
  employmentType?: EmploymentType;
  daysPerWeek?: number;
}

/**
 * Effective (actual earned) annual salary. `salary` on a FamilyMember is the
 * full-time-equivalent figure; part-time members earn a pro-rated share based
 * on daysPerWeek (out of 5). Members without employmentType set default to
 * full-time.
 */
export function effectiveSalary(m: { salary: number; employmentType?: EmploymentType; daysPerWeek?: number }): number {
  if (m.employmentType !== 'part-time') return m.salary;
  const days = m.daysPerWeek ?? 5;
  return m.salary * Math.max(0, Math.min(5, days)) / 5;
}

export type IncomeSourceType = 'dividend' | 'interest' | 'side' | 'other';
export type IncomeCadence = 'weekly' | 'fortnightly' | 'monthly' | 'annual';

export interface IncomeSource {
  id: string;
  type: IncomeSourceType;
  description: string;
  amount: number;
  cadence: IncomeCadence;
  owner?: string;
}

export type IncomeType = 'Salary' | 'Dividend' | 'Interest' | 'Side Income' | 'Other Income' | 'Rental';

export const INCOME_TYPES: IncomeType[] = ['Salary', 'Dividend', 'Interest', 'Side Income', 'Other Income', 'Rental'];

export interface Income {
  id: string;
  date: string;           // YYYY-MM-DD
  description: string;
  amount: number;
  type: IncomeType;
  financialYear: string;  // e.g. 2025-2026
  owner?: string;
}

export interface Investment {
  id: string;
  name: string;
  type: string;
  owner?: string;
  currentValue: number;
  costBasis: number;
  units?: number;
  buyPricePerUnit?: number;
  propertyType?: 'Investment' | 'Owner Occupied';
  address?: string;
  rentalIncomeMonthly?: number;
  liability?: number;
  interestRate?: number;
  employerContribution?: number;
  couponRate?: number;
  maturityDate?: string;
  monthlyRepayment?: number;
  // Live-price tracking (traded assets only). Yahoo Finance ticker, e.g.
  // "BHP.AX", "AAPL", "BTC-AUD". `lastPrice` is per-unit in AUD after FX.
  ticker?: string;
  lastPrice?: number;
  lastPriceCurrency?: string;
  lastPriceUpdate?: string;
}
