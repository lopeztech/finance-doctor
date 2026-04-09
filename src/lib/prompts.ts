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
  owner?: string;
  currentValue: number;
  costBasis: number;
  units?: number;
  interestRate?: number;
  employerContribution?: number;
  rentalIncomeAnnual?: number;
  liability?: number;
}

interface FamilyMemberInput {
  name: string;
  salary: number;
}

function getTaxBracket(salary: number): string {
  if (salary <= 18200) return '0% (tax-free threshold)';
  if (salary <= 45000) return '16%';
  if (salary <= 135000) return '30%';
  if (salary <= 190000) return '37%';
  return '45%';
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

  let familySection = '';
  if (familyMembers && familyMembers.length > 0) {
    const memberDetails = familyMembers.map(m =>
      `- ${m.name}: Salary $${m.salary.toLocaleString()}, Marginal tax rate: ${getTaxBracket(m.salary)} (+2% Medicare Levy)`
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
