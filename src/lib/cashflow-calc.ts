import type { Expense, FamilyMember, IncomeSource, IncomeCadence, Investment } from './types';
import type { CategorySettings, SpendingCategoryType } from './category-settings-repo';
import { resolveType } from './category-settings-repo';

export const AU_BRACKETS_2025_26 = [
  { upTo: 18200, rate: 0 },
  { upTo: 45000, rate: 0.16 },
  { upTo: 135000, rate: 0.30 },
  { upTo: 190000, rate: 0.37 },
  { upTo: Infinity, rate: 0.45 },
];

export const MEDICARE_LEVY_RATE = 0.02;

export function computeIncomeTax(taxable: number): number {
  if (taxable <= 0) return 0;
  let remaining = taxable;
  let lastCap = 0;
  let tax = 0;
  for (const bracket of AU_BRACKETS_2025_26) {
    const cap = bracket.upTo;
    const slice = Math.max(0, Math.min(remaining, cap - lastCap));
    tax += slice * bracket.rate;
    remaining -= slice;
    lastCap = cap;
    if (remaining <= 0) break;
  }
  return tax;
}

export function computeMedicareLevy(taxable: number): number {
  if (taxable <= 0) return 0;
  return taxable * MEDICARE_LEVY_RATE;
}

export function getMarginalRate(taxable: number): number {
  for (const bracket of AU_BRACKETS_2025_26) {
    if (taxable <= bracket.upTo) return bracket.rate;
  }
  return 0.45;
}

export function toMonthly(amount: number, cadence: IncomeCadence): number {
  if (cadence === 'monthly') return amount;
  if (cadence === 'annual') return amount / 12;
  if (cadence === 'weekly') return (amount * 52) / 12;
  if (cadence === 'fortnightly') return (amount * 26) / 12;
  return amount;
}

export function toAnnual(amount: number, cadence: IncomeCadence): number {
  return toMonthly(amount, cadence) * 12;
}

export interface MemberCashflow {
  id: string;
  name: string;
  salary: number;
  superSalarySacrifice: number;
  otherIncomeAnnual: number;
  investmentIncomeAnnual: number;
  deductionsAnnual: number;
  taxableIncome: number;
  incomeTax: number;
  medicareLevy: number;
  totalTax: number;
  marginalRate: number;
  netAnnual: number;
  netMonthly: number;
  grossAnnual: number;
  grossMonthly: number;
}

export interface InvestmentCashflow {
  rentalIncomeMonthly: number;
  rentalIncomeAnnual: number;
  interestMonthly: number;
  interestAnnual: number;
  repaymentMonthly: number;
  repaymentAnnual: number;
  linkedExpensesMonthly: number;
  linkedExpensesAnnual: number;
}

export interface CashflowSnapshot {
  members: MemberCashflow[];
  salariesGrossMonthly: number;
  salariesNetMonthly: number;
  otherIncomeMonthly: number;
  investmentIncomeMonthly: number;
  totalIncomeMonthly: number;
  loanRepaymentsMonthly: number;
  expensesMonthly: number;
  expensesByTypeMonthly: Record<SpendingCategoryType | 'unclassified', number>;
  outflowsMonthly: number;
  surplusMonthly: number;
  savingsRatePct: number;
  monthsCovered: number;
  investmentCashflow: InvestmentCashflow;
}

function attribute(
  amount: number,
  owner: string | undefined,
  members: FamilyMember[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (members.length === 0) return result;
  if (!owner) {
    const share = amount / members.length;
    for (const m of members) result.set(m.id, share);
    return result;
  }
  if (owner === 'Joint') {
    const share = amount / Math.max(members.length, 1);
    for (const m of members) result.set(m.id, share);
    return result;
  }
  const match = members.find(m => m.name === owner);
  if (match) {
    result.set(match.id, amount);
  } else {
    const share = amount / members.length;
    for (const m of members) result.set(m.id, share);
  }
  return result;
}

export function computeInvestmentCashflow(
  investments: Investment[],
  expenses: Expense[],
): InvestmentCashflow {
  let rentalAnnual = 0;
  let interestAnnual = 0;
  let repaymentMonthly = 0;
  for (const inv of investments) {
    if (inv.propertyType === 'Investment') {
      rentalAnnual += (inv.rentalIncomeMonthly || 0) * 12;
      if (inv.liability && inv.interestRate) {
        interestAnnual += (inv.liability * inv.interestRate) / 100;
      }
    }
    if (inv.monthlyRepayment) repaymentMonthly += inv.monthlyRepayment;
  }
  const monthCount = Math.max(monthsCoveredBy(expenses), 1);
  const linkedExpensesTotal = expenses
    .filter(e => e.investmentId)
    .reduce((s, e) => s + e.amount, 0);
  const linkedExpensesMonthly = linkedExpensesTotal / monthCount;

  return {
    rentalIncomeAnnual: rentalAnnual,
    rentalIncomeMonthly: rentalAnnual / 12,
    interestAnnual,
    interestMonthly: interestAnnual / 12,
    repaymentMonthly,
    repaymentAnnual: repaymentMonthly * 12,
    linkedExpensesMonthly,
    linkedExpensesAnnual: linkedExpensesMonthly * 12,
  };
}

export function monthsCoveredBy(expenses: Expense[]): number {
  const months = new Set<string>();
  for (const e of expenses) {
    if (e.date && e.date.length >= 7) months.add(e.date.substring(0, 7));
  }
  return months.size;
}

export function computeCashflow(input: {
  members: FamilyMember[];
  investments: Investment[];
  expenses: Expense[];
  incomeSources: IncomeSource[];
  categorySettings: CategorySettings;
}): CashflowSnapshot {
  const { members, investments, expenses, incomeSources, categorySettings } = input;

  const monthCount = Math.max(monthsCoveredBy(expenses), 1);
  const excluded = new Set(categorySettings.excluded);

  // Annualise expenses excluding user-excluded categories
  const cashflowExpenses = expenses.filter(e => !excluded.has(e.spendingCategory || 'Other'));
  const expensesTotal = cashflowExpenses.reduce((s, e) => s + e.amount, 0);
  const expensesMonthly = expensesTotal / monthCount;

  const expensesByTypeMonthly: Record<SpendingCategoryType | 'unclassified', number> = {
    essential: 0, committed: 0, discretionary: 0, unclassified: 0,
  };
  for (const e of cashflowExpenses) {
    const cat = e.spendingCategory || 'Other';
    const t = resolveType(cat, categorySettings) || 'unclassified';
    expensesByTypeMonthly[t] += e.amount / monthCount;
  }

  // Tax-deductible expenses per member (annualised)
  const deductionsByMember = new Map<string, number>();
  for (const m of members) deductionsByMember.set(m.id, 0);
  for (const e of expenses) {
    if (e.nonDeductible) continue;
    if (!e.category || e.category === 'Other Deductions') continue;
    const perMonth = e.amount / monthCount;
    const annualised = perMonth * 12;
    const attribution = attribute(annualised, e.owner, members);
    for (const [id, amt] of attribution) {
      deductionsByMember.set(id, (deductionsByMember.get(id) || 0) + amt);
    }
  }

  // Investment income per member (annualised rental − interest − linked expenses)
  const invIncomeByMember = new Map<string, number>();
  for (const m of members) invIncomeByMember.set(m.id, 0);
  for (const inv of investments) {
    if (inv.propertyType !== 'Investment') continue;
    const rental = (inv.rentalIncomeMonthly || 0) * 12;
    const interest = (inv.liability && inv.interestRate) ? (inv.liability * inv.interestRate) / 100 : 0;
    const linkedExpensesAnnual = expenses
      .filter(e => e.investmentId === inv.id)
      .reduce((s, e) => s + e.amount, 0) * (12 / monthCount);
    const net = rental - interest - linkedExpensesAnnual;
    const attribution = attribute(net, inv.owner, members);
    for (const [id, amt] of attribution) {
      invIncomeByMember.set(id, (invIncomeByMember.get(id) || 0) + amt);
    }
  }

  // Other income per member (annualised)
  const otherIncomeByMember = new Map<string, number>();
  for (const m of members) otherIncomeByMember.set(m.id, 0);
  for (const source of incomeSources) {
    const annual = toAnnual(source.amount, source.cadence);
    const attribution = attribute(annual, source.owner, members);
    for (const [id, amt] of attribution) {
      otherIncomeByMember.set(id, (otherIncomeByMember.get(id) || 0) + amt);
    }
  }

  const memberCashflows: MemberCashflow[] = members.map(m => {
    const superSacrifice = m.superSalarySacrifice || 0;
    const invIncome = invIncomeByMember.get(m.id) || 0;
    const otherIncome = otherIncomeByMember.get(m.id) || 0;
    const deductions = deductionsByMember.get(m.id) || 0;
    const taxable = Math.max(0, m.salary - superSacrifice + invIncome + otherIncome - deductions);
    const incomeTax = computeIncomeTax(taxable);
    const medicare = computeMedicareLevy(taxable);
    const totalTax = incomeTax + medicare;
    const grossAnnual = m.salary + invIncome + otherIncome;
    const netAnnual = grossAnnual - totalTax - superSacrifice;
    return {
      id: m.id,
      name: m.name,
      salary: m.salary,
      superSalarySacrifice: superSacrifice,
      otherIncomeAnnual: otherIncome,
      investmentIncomeAnnual: invIncome,
      deductionsAnnual: deductions,
      taxableIncome: taxable,
      incomeTax,
      medicareLevy: medicare,
      totalTax,
      marginalRate: getMarginalRate(taxable),
      netAnnual,
      netMonthly: netAnnual / 12,
      grossAnnual,
      grossMonthly: grossAnnual / 12,
    };
  });

  const salariesGrossMonthly = members.reduce((s, m) => s + m.salary / 12, 0);
  const salariesNetMonthly = memberCashflows.reduce((s, m) => s + m.netMonthly, 0);
  const otherIncomeMonthly = incomeSources.reduce((s, src) => s + toMonthly(src.amount, src.cadence), 0);
  const investmentCashflow = computeInvestmentCashflow(investments, expenses);
  const investmentIncomeMonthly = investmentCashflow.rentalIncomeMonthly - investmentCashflow.interestMonthly - investmentCashflow.linkedExpensesMonthly;

  const loanRepaymentsMonthly = investmentCashflow.repaymentMonthly;
  const totalIncomeMonthly = salariesNetMonthly; // salariesNetMonthly already includes investment + other income minus tax
  const outflowsMonthly = loanRepaymentsMonthly + expensesMonthly;
  const surplusMonthly = totalIncomeMonthly - outflowsMonthly;
  const savingsRatePct = totalIncomeMonthly > 0 ? (surplusMonthly / totalIncomeMonthly) * 100 : 0;

  return {
    members: memberCashflows,
    salariesGrossMonthly,
    salariesNetMonthly,
    otherIncomeMonthly,
    investmentIncomeMonthly,
    totalIncomeMonthly,
    loanRepaymentsMonthly,
    expensesMonthly,
    expensesByTypeMonthly,
    outflowsMonthly,
    surplusMonthly,
    savingsRatePct,
    monthsCovered: monthCount,
    investmentCashflow,
  };
}
