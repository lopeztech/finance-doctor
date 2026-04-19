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
  rentalIncomeAnnual?: number;
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
