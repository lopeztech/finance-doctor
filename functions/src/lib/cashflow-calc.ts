import type { Expense, FamilyMember, IncomeSource, IncomeCadence, Investment } from './types';

type SpendingCategoryType = 'essential' | 'committed' | 'discretionary';

const DEFAULT_CATEGORY_TYPES: Record<string, SpendingCategoryType> = {
  'Bakery': 'discretionary', 'Cafe': 'discretionary', 'Car': 'essential',
  'Dining & Takeaway': 'discretionary', 'Education': 'essential', 'Entertainment': 'discretionary',
  'Financial & Banking': 'committed', 'Gifts & Donations': 'discretionary', 'Groceries': 'essential',
  'Healthcare': 'essential', 'Home & Garden': 'discretionary', 'Insurance': 'essential',
  'Kids Entertainment': 'discretionary', 'Personal Care': 'discretionary', 'Personal Project': 'discretionary',
  'Shopping': 'discretionary', 'Subscriptions': 'committed', 'Transport': 'essential',
  'Travel & Holidays': 'discretionary', 'Utilities & Bills': 'essential', 'Other': 'discretionary',
};

const AU_BRACKETS = [
  { upTo: 18200, rate: 0 },
  { upTo: 45000, rate: 0.16 },
  { upTo: 135000, rate: 0.30 },
  { upTo: 190000, rate: 0.37 },
  { upTo: Infinity, rate: 0.45 },
];
const MEDICARE_LEVY_RATE = 0.02;

function incomeTax(taxable: number): number {
  if (taxable <= 0) return 0;
  let remaining = taxable, lastCap = 0, tax = 0;
  for (const b of AU_BRACKETS) {
    const slice = Math.max(0, Math.min(remaining, b.upTo - lastCap));
    tax += slice * b.rate;
    remaining -= slice;
    lastCap = b.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

function toAnnual(amount: number, cadence: IncomeCadence): number {
  if (cadence === 'annual') return amount;
  if (cadence === 'monthly') return amount * 12;
  if (cadence === 'weekly') return amount * 52;
  if (cadence === 'fortnightly') return amount * 26;
  return amount;
}

function attribute(amount: number, owner: string | undefined, members: FamilyMember[]): Map<string, number> {
  const result = new Map<string, number>();
  if (members.length === 0) return result;
  if (!owner || owner === 'Joint') {
    const share = amount / members.length;
    for (const m of members) result.set(m.id, share);
    return result;
  }
  const match = members.find(m => m.name === owner);
  if (match) result.set(match.id, amount);
  else {
    const share = amount / members.length;
    for (const m of members) result.set(m.id, share);
  }
  return result;
}

export interface CashflowSummary {
  salariesGrossMonthly: number;
  salariesNetMonthly: number;
  otherIncomeMonthly: number;
  rentalIncomeMonthly: number;
  totalIncomeMonthly: number;
  loanRepaymentsMonthly: number;
  expensesMonthly: number;
  expensesByTypeMonthly: Record<string, number>;
  outflowsMonthly: number;
  surplusMonthly: number;
  savingsRatePct: number;
  members: Array<{ name: string; grossAnnual: number; netAnnual: number; totalTax: number; taxableIncome: number }>;
}

export function computeCashflowSummary(input: {
  members: FamilyMember[];
  investments: Investment[];
  expenses: Expense[];
  incomeSources: IncomeSource[];
  categoryTypes: Record<string, SpendingCategoryType>;
  excluded: string[];
}): CashflowSummary {
  const { members, investments, expenses, incomeSources, categoryTypes, excluded } = input;
  const excludedSet = new Set(excluded);
  const months = new Set<string>();
  for (const e of expenses) if (e.date && e.date.length >= 7) months.add(e.date.substring(0, 7));
  const monthCount = Math.max(months.size, 1);

  const cashflowExpenses = expenses.filter(e => !excludedSet.has(e.spendingCategory || 'Other'));
  const expensesTotal = cashflowExpenses.reduce((s, e) => s + e.amount, 0);
  const expensesMonthly = expensesTotal / monthCount;

  const expensesByTypeMonthly: Record<string, number> = { essential: 0, committed: 0, discretionary: 0, unclassified: 0 };
  for (const e of cashflowExpenses) {
    const cat = e.spendingCategory || 'Other';
    const t = categoryTypes[cat] ?? DEFAULT_CATEGORY_TYPES[cat] ?? 'unclassified';
    expensesByTypeMonthly[t] += e.amount / monthCount;
  }

  const deductionsByMember = new Map<string, number>();
  for (const m of members) deductionsByMember.set(m.id, 0);
  for (const e of expenses) {
    if (e.nonDeductible) continue;
    if (!e.category || e.category === 'Other Deductions') continue;
    const annual = (e.amount / monthCount) * 12;
    for (const [id, amt] of attribute(annual, e.owner, members)) {
      deductionsByMember.set(id, (deductionsByMember.get(id) || 0) + amt);
    }
  }

  const invIncomeByMember = new Map<string, number>();
  for (const m of members) invIncomeByMember.set(m.id, 0);
  let rentalAnnualTotal = 0, repaymentMonthlyTotal = 0;
  for (const inv of investments) {
    if (inv.monthlyRepayment) repaymentMonthlyTotal += inv.monthlyRepayment;
    if (inv.propertyType !== 'Investment') continue;
    const rental = (inv.rentalIncomeMonthly || 0) * 12;
    rentalAnnualTotal += rental;
    const interest = (inv.liability && inv.interestRate) ? (inv.liability * inv.interestRate) / 100 : 0;
    const linkedAnnual = expenses.filter(e => e.investmentId === inv.id).reduce((s, e) => s + e.amount, 0) * (12 / monthCount);
    const net = rental - interest - linkedAnnual;
    for (const [id, amt] of attribute(net, inv.owner, members)) {
      invIncomeByMember.set(id, (invIncomeByMember.get(id) || 0) + amt);
    }
  }

  const otherIncomeByMember = new Map<string, number>();
  for (const m of members) otherIncomeByMember.set(m.id, 0);
  for (const src of incomeSources) {
    const annual = toAnnual(src.amount, src.cadence);
    for (const [id, amt] of attribute(annual, src.owner, members)) {
      otherIncomeByMember.set(id, (otherIncomeByMember.get(id) || 0) + amt);
    }
  }

  const memberSummaries = members.map(m => {
    const superSac = m.superSalarySacrifice || 0;
    const invIncome = invIncomeByMember.get(m.id) || 0;
    const otherIncome = otherIncomeByMember.get(m.id) || 0;
    const deductions = deductionsByMember.get(m.id) || 0;
    const taxable = Math.max(0, m.salary - superSac + invIncome + otherIncome - deductions);
    const tax = incomeTax(taxable) + taxable * MEDICARE_LEVY_RATE;
    const grossAnnual = m.salary + invIncome + otherIncome;
    const netAnnual = grossAnnual - tax - superSac;
    return { name: m.name, grossAnnual, netAnnual, totalTax: tax, taxableIncome: taxable };
  });

  const salariesGrossMonthly = members.reduce((s, m) => s + m.salary / 12, 0);
  const salariesNetMonthly = memberSummaries.reduce((s, m) => s + m.netAnnual / 12, 0);
  const otherIncomeMonthly = incomeSources.reduce((s, src) => s + toAnnual(src.amount, src.cadence) / 12, 0);
  const rentalIncomeMonthly = rentalAnnualTotal / 12;
  const totalIncomeMonthly = salariesNetMonthly;
  const outflowsMonthly = repaymentMonthlyTotal + expensesMonthly;
  const surplusMonthly = totalIncomeMonthly - outflowsMonthly;
  const savingsRatePct = totalIncomeMonthly > 0 ? (surplusMonthly / totalIncomeMonthly) * 100 : 0;

  return {
    salariesGrossMonthly, salariesNetMonthly, otherIncomeMonthly, rentalIncomeMonthly,
    totalIncomeMonthly, loanRepaymentsMonthly: repaymentMonthlyTotal, expensesMonthly,
    expensesByTypeMonthly, outflowsMonthly, surplusMonthly, savingsRatePct,
    members: memberSummaries,
  };
}
