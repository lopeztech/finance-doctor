export const TAX_SYSTEM_PROMPT = `You are an Australian tax advisor AI assistant called "Finance Doctor".
You provide personalised tax advice based on the user's expense data for the Australian financial year.

Key context:
- Australian Tax Office (ATO) rules apply
- Financial year runs July 1 to June 30
- Common deduction categories: work from home, vehicle & travel, clothing & laundry, self-education, tools & equipment, professional memberships, phone & internet, donations, investment expenses
- Capital Gains Tax (CGT) applies to investment disposals with a 50% discount for assets held >12 months
- Negative gearing on investment properties is deductible
- Superannuation salary sacrifice reduces taxable income (concessional cap $30,000/yr including employer contributions)
- Private health insurance can affect Medicare Levy Surcharge

Your response style:
- Use the "doctor" metaphor: give a Diagnosis (what you observe) and a Prescription (what to do)
- Be specific with dollar amounts and percentages where possible
- Reference ATO rules when relevant
- When a job title or industry is provided, tailor deduction suggestions to that occupation (e.g. nurses can claim uniforms/laundry, IT workers can claim home office equipment, teachers can claim self-education)
- Suggest deductions the user may be missing based on their profile and occupation
- Flag any red flags that could trigger an ATO audit
- Keep advice actionable and concise
- Format your response as clean HTML using semantic tags: <h4>, <h5>, <p>, <ul>/<ol> with <li>, <strong>, <em>, <hr>, and <span class="badge bg-success/bg-warning/bg-danger"> for status indicators
- Use <h4> for main sections (Diagnosis, Prescription) and <h5> for subsections
- Do NOT wrap the response in <html>, <head>, or <body> tags — just the content HTML
- Use <ul> or <ol> for lists of recommendations
- Use <strong> to highlight key dollar amounts and percentages`;

export const INVESTMENT_SYSTEM_PROMPT = `You are an Australian investment advisor AI assistant called "Finance Doctor".
You provide personalised investment strategy advice based on the user's family portfolio data.

Key context:
- Australian financial context (AUD, ASX, Australian super system)
- This is a FAMILY portfolio — investments may be owned by different family members with different salaries and tax brackets
- Australian individual income tax brackets (2025-26): $0-$18,200 tax-free, $18,201-$45,000 at 16%, $45,001-$135,000 at 30%, $135,001-$190,000 at 37%, $190,001+ at 45%, plus 2% Medicare Levy
- Capital Gains Tax (CGT): added to assessable income, taxed at the individual's marginal rate. 50% discount for assets held >12 months
- When family members have different tax brackets, CGT impact varies significantly — highlight this
- Investments can be owned "Joint" — CGT is split 50/50 between two members, each taxed at their own marginal rate
- Superannuation Guarantee (SG) rate is 12% (rising to 12.5% from July 2025)
- Concessional super contribution cap is $30,000/yr
- Franking credits on Australian dividends
- Common Australian ETFs: VAS (ASX 300), VGS (International), VDHG (Diversified High Growth), A200 (ASX 200)
- Diversification across: Australian equities, international equities, property, bonds, cash, alternatives
- Risk profiles: conservative, balanced, growth, high growth

Your response style:
- Use the "doctor" metaphor: give a Diagnosis (portfolio health) and a Prescription (what to change)
- Assess diversification, concentration risk, defensive vs growth allocation
- When family members are provided, analyse each member's holdings and tax position separately
- Calculate estimated CGT for each member based on their marginal tax rate if they were to sell
- Suggest tax-optimised strategies: which family member should hold income-producing vs growth assets
- Consider spouse contribution strategies and income splitting opportunities
- Suggest specific rebalancing actions with target percentages
- Highlight tax implications of any suggested trades, specific to each owner's tax bracket
- Mention relevant super strategies (salary sacrifice, spouse contributions)
- Keep advice actionable and concise
- Include a disclaimer that this is general advice, not personal financial advice
- Format your response as clean HTML using semantic tags: <h4>, <h5>, <p>, <ul>/<ol> with <li>, <strong>, <em>, <hr>, and <span class="badge bg-success/bg-warning/bg-danger"> for status indicators
- Use <h4> for main sections (Diagnosis, Prescription) and <h5> for subsections
- Do NOT wrap the response in <html>, <head>, or <body> tags — just the content HTML
- Use <ul> or <ol> for lists of recommendations
- Use <strong> to highlight key dollar amounts and percentages`;

export const EXPENSES_SYSTEM_PROMPT = `You are an Australian household cashflow advisor AI assistant called "Finance Doctor".
You analyse spending patterns and advise how to improve cashflow, cut waste, and decide which expenses to drop.

Key context:
- Australian household context (AUD, cost-of-living pressures, ATO deduction distinction)
- Each spending category is classified into one of three types: ESSENTIAL (unavoidable — groceries, utilities, transport, healthcare, insurance, housing), COMMITTED (reducible fixed costs — subscriptions, phone plans, gyms), or DISCRETIONARY (fully avoidable — dining, entertainment, shopping, travel).
- The user has already excluded tax-only expenses (e.g. investment property interest) from the data you see, so everything below reflects genuine cashflow.
- Prioritise cuts on DISCRETIONARY first, then COMMITTED (renegotiate/downgrade/cancel), and treat ESSENTIAL as a floor unless there is a clear overspend signal.
- The user provides a full household cashflow context: net income, outflows, surplus/deficit, and savings rate. Anchor your diagnosis in that context — a $500/mo subscription is very different against $6k vs $20k monthly income. Recommend cuts that raise the savings rate toward a healthy 20%+ target for Australian households.
- Subscription creep is a common cashflow leak — flag repeat small charges
- Lifestyle inflation: rising dining/takeaway and shopping often mask underlying budget drift
- Tax-deductible expenses (nonDeductible=false and tax category ≠ "Other Deductions") shouldn't be cut without considering the after-tax cost

Your response style:
- Use the "doctor" metaphor: Diagnosis (cashflow health) and Prescription (what to drop or cut)
- Be specific with dollar amounts, monthly averages, and percentages of total spend
- Rank recommendations by impact: largest saving first
- For each suggestion include: the category/vendor, estimated monthly saving, and why it's a candidate
- Separate "quick wins" (cancel/downgrade today) from "lifestyle shifts" (harder behavioural changes)
- Flag recurring/subscription charges and duplicates
- Call out categories where spending looks unusually high vs a reasonable benchmark for an Australian household
- Do NOT suggest dropping tax-deductible work expenses without noting the after-tax cost
- Keep advice actionable and concise
- Include a short disclaimer that this is general advice, not personal financial advice
- Format your response as clean HTML using semantic tags: <h4>, <h5>, <p>, <ul>/<ol> with <li>, <strong>, <em>, <hr>, and <span class="badge bg-success/bg-warning/bg-danger"> for status indicators
- Use <h4> for main sections (Diagnosis, Prescription) and <h5> for subsections
- Do NOT wrap the response in <html>, <head>, or <body> tags — just the content HTML
- Use <ul> or <ol> for lists of recommendations
- Use <strong> to highlight key dollar amounts and percentages`;

interface ExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
}

interface InvestmentInput {
  name: string;
  type: string;
  owner?: string;
  currentValue: number;
  costBasis: number;
  units?: number;
  interestRate?: number;
  employerContribution?: number;
  rentalIncomeMonthly?: number;
  liability?: number;
  address?: string;
  monthlyRepayment?: number;
  propertyType?: 'Investment' | 'Owner Occupied';
}

interface FamilyMemberInput {
  name: string;
  salary: number;
  job?: string;
}

function getTaxBracket(salary: number): string {
  if (salary <= 18200) return '0% (tax-free threshold)';
  if (salary <= 45000) return '16%';
  if (salary <= 135000) return '30%';
  if (salary <= 190000) return '37%';
  return '45%';
}

export function buildTaxPrompt(expenses: ExpenseInput[], financialYear: string, familyMembers?: FamilyMemberInput[]): string {
  const totalDeductions = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals: Record<string, number> = {};
  expenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const breakdown = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, total]) => `- ${cat}: $${total.toFixed(2)}`)
    .join('\n');

  const recentExpenses = expenses.slice(0, 20)
    .map(e => `- ${e.date}: ${e.description} ($${e.amount.toFixed(2)}) [${e.category}]`)
    .join('\n');

  let memberSection = '';
  if (familyMembers && familyMembers.length > 0) {
    const memberDetails = familyMembers.map(m =>
      `- ${m.name}${m.job ? ` (${m.job})` : ''}: Salary $${m.salary.toLocaleString()}, Marginal rate: ${getTaxBracket(m.salary)}`
    ).join('\n');
    memberSection = `\nFamily members:\n${memberDetails}\n`;
  }

  return `Analyse my tax deductions for FY ${financialYear} and provide your diagnosis and prescription.
${memberSection}
Total deductions claimed: $${totalDeductions.toFixed(2)}
Number of expenses: ${expenses.length}

Breakdown by category:
${breakdown}

Recent expenses:
${recentExpenses}

Please provide:
1. A health assessment of my deduction claims
2. Industry-specific deductions I may be missing based on my occupation
3. Categories I may be under-claiming or missing entirely
4. Any red flags or audit risks
5. Specific actions to improve my tax position before EOFY`;
}

export function buildInvestmentPrompt(investments: InvestmentInput[], familyMembers?: FamilyMemberInput[]): string {
  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const gainLoss = totalValue - totalCost;
  const returnPct = totalCost > 0 ? ((gainLoss / totalCost) * 100).toFixed(1) : '0.0';

  const holdings = investments.map(i => {
    const gl = i.currentValue - i.costBasis;
    const pct = i.costBasis > 0 ? ((gl / i.costBasis) * 100).toFixed(1) : '0.0';
    let detail = `- ${i.name} (${i.type}): Value $${i.currentValue.toLocaleString()}, Cost $${i.costBasis.toLocaleString()}, Return ${gl >= 0 ? '+' : ''}${pct}%`;
    if (i.owner) detail += `, Owner: ${i.owner}`;
    if (i.address) detail += `, Address: ${i.address}`;
    if (i.propertyType) detail += `, Use: ${i.propertyType}`;
    if (i.liability) detail += `, Mortgage $${i.liability.toLocaleString()}`;
    if (i.monthlyRepayment) detail += `, Repayment $${i.monthlyRepayment.toLocaleString()}/mo`;
    if (i.rentalIncomeMonthly) detail += `, Rental $${Math.round(i.rentalIncomeMonthly).toLocaleString()}/mo`;
    if (i.interestRate) detail += `, Rate ${i.interestRate}%`;
    if (i.employerContribution) detail += `, Employer ${i.employerContribution}%`;
    return detail;
  }).join('\n');

  const allocationByType: Record<string, number> = {};
  investments.forEach(i => {
    allocationByType[i.type] = (allocationByType[i.type] || 0) + i.currentValue;
  });
  const allocation = Object.entries(allocationByType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, value]) => `- ${type}: $${value.toLocaleString()} (${((value / totalValue) * 100).toFixed(1)}%)`)
    .join('\n');

  let familySection = '';
  if (familyMembers && familyMembers.length > 0) {
    const memberDetails = familyMembers.map(m =>
      `- ${m.name}${m.job ? ` (${m.job})` : ''}: Salary $${m.salary.toLocaleString()}, Marginal tax rate: ${getTaxBracket(m.salary)} (+2% Medicare Levy)`
    ).join('\n');

    const ownershipByMember: Record<string, { value: number; gain: number }> = {};
    investments.forEach(i => {
      const owner = i.owner || 'Unassigned';
      if (!ownershipByMember[owner]) ownershipByMember[owner] = { value: 0, gain: 0 };
      ownershipByMember[owner].value += i.currentValue;
      ownershipByMember[owner].gain += i.currentValue - i.costBasis;
    });
    const ownershipBreakdown = Object.entries(ownershipByMember)
      .map(([owner, data]) => `- ${owner}: Value $${data.value.toLocaleString()}, Unrealised gain $${data.gain.toLocaleString()}`)
      .join('\n');

    familySection = `

Family Members:
${memberDetails}

Portfolio by Owner:
${ownershipBreakdown}`;
  }

  return `Analyse my family investment portfolio and provide your diagnosis and prescription.

Portfolio Summary:
- Total value: $${totalValue.toLocaleString()}
- Total cost basis: $${totalCost.toLocaleString()}
- Overall return: ${gainLoss >= 0 ? '+' : ''}$${gainLoss.toLocaleString()} (${returnPct}%)
${familySection}
Asset Allocation:
${allocation}

Holdings:
${holdings}

Please provide:
1. Portfolio health assessment (diversification, risk profile, concentration)
2. Per-member tax analysis: estimated CGT impact if gains were realised, based on each member's marginal rate
3. Tax-optimisation strategies: suggest which member should hold income-producing vs growth assets
4. Specific rebalancing recommendations with target allocations
5. What to do next — specific actions ranked by priority`;
}

const DEFAULT_CATEGORY_TYPES: Record<string, 'essential' | 'committed' | 'discretionary'> = {
  'Bakery': 'discretionary', 'Cafe': 'discretionary', 'Car': 'essential',
  'Dining & Takeaway': 'discretionary', 'Education': 'essential', 'Entertainment': 'discretionary',
  'Financial & Banking': 'committed', 'Gifts & Donations': 'discretionary', 'Groceries': 'essential',
  'Healthcare': 'essential', 'Home & Garden': 'discretionary', 'Insurance': 'essential',
  'Kids Entertainment': 'discretionary', 'Personal Care': 'discretionary', 'Personal Project': 'discretionary',
  'Shopping': 'discretionary', 'Subscriptions': 'committed', 'Transport': 'essential',
  'Travel & Holidays': 'discretionary', 'Utilities & Bills': 'essential', 'Other': 'discretionary',
};

interface CashflowSummaryInput {
  salariesGrossMonthly: number;
  salariesNetMonthly: number;
  otherIncomeMonthly: number;
  rentalIncomeMonthly: number;
  totalIncomeMonthly: number;
  loanRepaymentsMonthly: number;
  expensesMonthly: number;
  outflowsMonthly: number;
  surplusMonthly: number;
  savingsRatePct: number;
  members: Array<{ name: string; grossAnnual: number; netAnnual: number; totalTax: number; taxableIncome: number }>;
}

export function buildExpensesPrompt(
  expenses: ExpenseInput[],
  categoryTypes: Record<string, 'essential' | 'committed' | 'discretionary'> = {},
  cashflow?: CashflowSummaryInput,
): string {
  const resolveType = (cat: string) => categoryTypes[cat] ?? DEFAULT_CATEGORY_TYPES[cat];
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  const months = new Set<string>();
  for (const e of expenses) {
    if (e.date && e.date.length >= 7) months.add(e.date.substring(0, 7));
  }
  const monthCount = Math.max(months.size, 1);
  const avgMonthly = totalSpend / monthCount;

  const spendingTotals: Record<string, { total: number; count: number }> = {};
  for (const e of expenses) {
    const cat = e.spendingCategory || 'Other';
    if (!spendingTotals[cat]) spendingTotals[cat] = { total: 0, count: 0 };
    spendingTotals[cat].total += e.amount;
    spendingTotals[cat].count += 1;
  }
  const spendingBreakdown = Object.entries(spendingTotals)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([cat, d]) => {
      const t = resolveType(cat);
      const tag = t ? `[${t.toUpperCase()}]` : '[UNCLASSIFIED]';
      return `- ${cat} ${tag}: $${d.total.toFixed(2)} (${((d.total / totalSpend) * 100).toFixed(1)}%) across ${d.count} txns, ~$${(d.total / monthCount).toFixed(2)}/mo`;
    })
    .join('\n');

  const typeTotals: Record<string, number> = { essential: 0, committed: 0, discretionary: 0, unclassified: 0 };
  for (const [cat, d] of Object.entries(spendingTotals)) {
    const t = resolveType(cat) || 'unclassified';
    typeTotals[t] = (typeTotals[t] || 0) + d.total;
  }
  const typeBreakdown = ['essential', 'committed', 'discretionary', 'unclassified']
    .filter(t => typeTotals[t] > 0)
    .map(t => `- ${t.toUpperCase()}: $${typeTotals[t].toFixed(2)} (${((typeTotals[t] / totalSpend) * 100).toFixed(1)}%)`)
    .join('\n');

  const vendorTotals: Record<string, { total: number; count: number; category: string; nonDeductible: boolean }> = {};
  for (const e of expenses) {
    const key = e.description || '(blank)';
    if (!vendorTotals[key]) {
      vendorTotals[key] = { total: 0, count: 0, category: e.spendingCategory || 'Other', nonDeductible: Boolean(e.nonDeductible) };
    }
    vendorTotals[key].total += e.amount;
    vendorTotals[key].count += 1;
  }
  const topVendors = Object.entries(vendorTotals)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 25)
    .map(([desc, d]) => `- "${desc}" [${d.category}${d.nonDeductible ? ', non-deductible' : ''}]: $${d.total.toFixed(2)} over ${d.count} txns (avg $${(d.total / d.count).toFixed(2)})`)
    .join('\n');

  const recurringVendors = Object.entries(vendorTotals)
    .filter(([, d]) => d.count >= 3)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 20)
    .map(([desc, d]) => `- "${desc}" [${d.category}]: ${d.count}× totalling $${d.total.toFixed(2)} (avg $${(d.total / d.count).toFixed(2)})`)
    .join('\n') || '- (none detected)';

  const monthlyTotals: Record<string, number> = {};
  for (const e of expenses) {
    const m = e.date?.substring(0, 7);
    if (!m) continue;
    monthlyTotals[m] = (monthlyTotals[m] || 0) + e.amount;
  }
  const monthlyTrend = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, t]) => `- ${m}: $${t.toFixed(2)}`)
    .join('\n');

  const cashflowBlock = cashflow && cashflow.members.length > 0 ? `
Family cashflow context (use this as the denominator for your analysis):
- Net household income (monthly, after tax + super sacrifice): $${cashflow.totalIncomeMonthly.toFixed(2)}
- Salaries gross (monthly): $${cashflow.salariesGrossMonthly.toFixed(2)}
- Rental income (monthly): $${cashflow.rentalIncomeMonthly.toFixed(2)}
- Other income (monthly): $${cashflow.otherIncomeMonthly.toFixed(2)}
- Loan repayments (monthly): $${cashflow.loanRepaymentsMonthly.toFixed(2)}
- Reported household expenses (monthly, excluding user-excluded categories): $${cashflow.expensesMonthly.toFixed(2)}
- Total monthly outflows (loan repayments + expenses): $${cashflow.outflowsMonthly.toFixed(2)}
- Monthly surplus (or deficit if negative): $${cashflow.surplusMonthly.toFixed(2)}
- Savings rate: ${cashflow.savingsRatePct.toFixed(1)}%

Per-member tax position:
${cashflow.members.map(m => `- ${m.name}: gross $${m.grossAnnual.toFixed(0)}/yr, taxable $${m.taxableIncome.toFixed(0)}, tax $${m.totalTax.toFixed(0)}, net $${m.netAnnual.toFixed(0)}`).join('\n')}

Your diagnosis MUST reference the savings rate, surplus/deficit, and whether outflows are sustainable given income. Frame cuts around raising the savings rate, not just lowering a category total.
` : '';

  return `Analyse my household spending and deliver a cashflow diagnosis and a prescription for what to drop or cut.
${cashflowBlock}
Overall:
- Total spend observed: $${totalSpend.toFixed(2)}
- Transactions: ${expenses.length}
- Months covered: ${monthCount}
- Average monthly spend: $${avgMonthly.toFixed(2)}

Spending by type (3-tier framework — focus your cuts here):
${typeBreakdown}

Spending by category (sorted by total, tagged with type):
${spendingBreakdown}

Monthly totals:
${monthlyTrend}

Top 25 vendors / descriptions by total spend:
${topVendors}

Likely recurring vendors (3+ hits):
${recurringVendors}

Please provide:
1. A cashflow health assessment — including the current savings rate, whether income comfortably covers outflows, and the biggest structural risks
2. A ranked list of specific expenses to consider dropping or reducing, with estimated monthly saving per item AND the impact on savings rate
3. Subscription / recurring creep to review
4. Lifestyle shifts that would have the biggest impact
5. Any risks if these cuts are made (e.g. cutting deductible work expenses, kid-related needs)`;
}
