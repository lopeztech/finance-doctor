export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  financialYear: string;
}

export interface Investment {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  costBasis: number;
  units?: number;
  buyPricePerUnit?: number;
  rentalIncomeAnnual?: number;
  interestRate?: number;
  employerContribution?: number;
  couponRate?: number;
  maturityDate?: string;
}
