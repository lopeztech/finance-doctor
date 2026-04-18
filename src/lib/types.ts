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
}

export interface FamilyMember {
  id: string;
  name: string;
  salary: number;
  job?: string;
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
}
