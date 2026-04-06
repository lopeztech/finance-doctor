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
- Suggest deductions the user may be missing based on their profile
- Flag any red flags that could trigger an ATO audit
- Keep advice actionable and concise
- Use markdown formatting for readability`;

export const INVESTMENT_SYSTEM_PROMPT = `You are an Australian investment advisor AI assistant called "Finance Doctor".
You provide personalised investment strategy advice based on the user's portfolio data.

Key context:
- Australian financial context (AUD, ASX, Australian super system)
- Superannuation Guarantee (SG) rate is 12% (rising to 12.5% from July 2025)
- Concessional super contribution cap is $30,000/yr
- CGT 50% discount for assets held >12 months
- Franking credits on Australian dividends
- Common Australian ETFs: VAS (ASX 300), VGS (International), VDHG (Diversified High Growth), A200 (ASX 200)
- Diversification across: Australian equities, international equities, property, bonds, cash, alternatives
- Risk profiles: conservative, balanced, growth, high growth

Your response style:
- Use the "doctor" metaphor: give a Diagnosis (portfolio health) and a Prescription (what to change)
- Assess diversification, concentration risk, defensive vs growth allocation
- Consider the user's likely risk profile based on their holdings
- Suggest specific rebalancing actions with target percentages
- Highlight tax implications of any suggested trades
- Mention relevant super strategies (salary sacrifice, spouse contributions)
- Keep advice actionable and concise
- Use markdown formatting for readability
- Include a disclaimer that this is general advice, not personal financial advice`;

interface ExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
}

export function buildTaxPrompt(expenses: ExpenseInput[], financialYear: string): string {
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

  return `Analyse my tax deductions for FY ${financialYear} and provide your diagnosis and prescription.

Total deductions claimed: $${totalDeductions.toFixed(2)}
Number of expenses: ${expenses.length}

Breakdown by category:
${breakdown}

Recent expenses:
${recentExpenses}

Please provide:
1. A health assessment of my deduction claims
2. Categories I may be under-claiming or missing entirely
3. Any red flags or audit risks
4. Specific actions to improve my tax position before EOFY`;
}

interface InvestmentInput {
  name: string;
  type: string;
  currentValue: number;
  costBasis: number;
  units?: number;
  interestRate?: number;
  employerContribution?: number;
  rentalIncomeAnnual?: number;
  liability?: number;
}

export function buildInvestmentPrompt(investments: InvestmentInput[]): string {
  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const gainLoss = totalValue - totalCost;
  const returnPct = totalCost > 0 ? ((gainLoss / totalCost) * 100).toFixed(1) : '0.0';

  const holdings = investments.map(i => {
    const gl = i.currentValue - i.costBasis;
    const pct = i.costBasis > 0 ? ((gl / i.costBasis) * 100).toFixed(1) : '0.0';
    let detail = `- ${i.name} (${i.type}): Value $${i.currentValue.toLocaleString()}, Cost $${i.costBasis.toLocaleString()}, Return ${gl >= 0 ? '+' : ''}${pct}%`;
    if (i.liability) detail += `, Mortgage $${i.liability.toLocaleString()}`;
    if (i.rentalIncomeAnnual) detail += `, Rental $${i.rentalIncomeAnnual.toLocaleString()}/yr`;
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

  return `Analyse my investment portfolio and provide your diagnosis and prescription.

Portfolio Summary:
- Total value: $${totalValue.toLocaleString()}
- Total cost basis: $${totalCost.toLocaleString()}
- Overall return: ${gainLoss >= 0 ? '+' : ''}$${gainLoss.toLocaleString()} (${returnPct}%)

Asset Allocation:
${allocation}

Holdings:
${holdings}

Please provide:
1. Portfolio health assessment (diversification, risk profile, concentration)
2. Specific rebalancing recommendations with target allocations
3. Tax-efficient strategies (CGT, franking credits, super)
4. What to do next — specific actions ranked by priority`;
}
