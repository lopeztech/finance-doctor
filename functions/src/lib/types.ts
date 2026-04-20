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

export interface FamilyMember {
  id: string;
  name: string;
  salary: number;
  job?: string;
  superSalarySacrifice?: number;
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
  date: string;
  description: string;
  amount: number;
  type: IncomeType;
  financialYear: string;
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
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
