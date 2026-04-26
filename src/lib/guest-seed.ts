import type { Expense, FamilyMember, Investment } from './types';

interface CategoryRule {
  id: string;
  pattern: string;
  taxCategory?: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GuestSeed {
  familyMembers: FamilyMember[];
  expenses: Expense[];
  investments: Investment[];
  categoryRules: CategoryRule[];
  adviceChats: Record<string, ChatMessage[] | string[]>;
}

function fy(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function exp(
  id: string,
  date: string,
  description: string,
  amount: number,
  category: string,
  spendingCategory: string,
  owner: string,
  extras: Partial<Expense> = {},
): Expense {
  return { id, date, description, amount, category, spendingCategory, financialYear: fy(date), owner, ...extras };
}

const FAMILY: FamilyMember[] = [
  { id: 'fm-1', name: 'Sam', salary: 145000, job: 'Software Engineer' },
  { id: 'fm-2', name: 'Alex', salary: 92000, job: 'Registered Nurse' },
];

const INVESTMENTS: Investment[] = [
  { id: 'inv-1', name: 'VAS', type: 'ETFs', owner: 'Sam', units: 450, buyPricePerUnit: 88.5, costBasis: 39825, currentValue: 45900, ticker: 'VAS.AX' },
  { id: 'inv-2', name: 'VGS', type: 'ETFs', owner: 'Sam', units: 220, buyPricePerUnit: 105.2, costBasis: 23144, currentValue: 28380, ticker: 'VGS.AX' },
  { id: 'inv-3', name: 'CBA', type: 'Australian Shares', owner: 'Alex', units: 120, buyPricePerUnit: 102.4, costBasis: 12288, currentValue: 15840, ticker: 'CBA.AX' },
  { id: 'inv-4', name: '42 Moreland St, Brunswick', type: 'Property', owner: 'Joint', propertyType: 'Investment', address: '42 Moreland St, Brunswick VIC 3056', costBasis: 720000, currentValue: 895000, liability: 512000, rentalIncomeMonthly: 2600 },
  { id: 'inv-5', name: 'AustralianSuper', type: 'Superannuation', owner: 'Sam', costBasis: 142000, currentValue: 142000, employerContribution: 12 },
  { id: 'inv-6', name: 'AustralianSuper', type: 'Superannuation', owner: 'Alex', costBasis: 86000, currentValue: 86000, employerContribution: 12 },
  { id: 'inv-7', name: 'ING Savings Maximiser', type: 'Cash / Term Deposit', owner: 'Joint', costBasis: 24500, currentValue: 24500, interestRate: 5.5 },
];

const EXPENSES: Expense[] = [
  exp('e1', '2025-07-12', 'Officeworks — standing desk', 499.00, 'Work from Home', 'Home & Garden', 'Sam'),
  exp('e2', '2025-07-22', 'Telstra — home internet', 89.00, 'Phone & Internet', 'Utilities & Bills', 'Sam'),
  exp('e3', '2025-08-03', 'Udemy — Kubernetes course', 129.00, 'Self-Education', 'Education', 'Sam'),
  exp('e4', '2025-08-14', 'Shell — fuel', 78.40, 'Vehicle & Travel', 'Transport', 'Alex'),
  exp('e5', '2025-08-28', 'Nursing uniform supplier', 215.50, 'Clothing & Laundry', 'Shopping', 'Alex'),
  exp('e6', '2025-09-05', 'ACS membership', 290.00, 'Professional Memberships', 'Subscriptions', 'Sam'),
  exp('e7', '2025-09-19', 'Red Cross donation', 100.00, 'Donations', 'Gifts & Donations', 'Sam'),
  exp('e8', '2025-10-02', 'Apple — MagSafe charger', 65.00, 'Tools & Equipment', 'Shopping', 'Sam'),
  exp('e9', '2025-10-15', 'NRMA car insurance', 842.00, 'Vehicle & Travel', 'Insurance', 'Alex'),
  exp('e10', '2025-10-24', 'Optus mobile — Sam', 55.00, 'Phone & Internet', 'Utilities & Bills', 'Sam'),
  exp('e11', '2025-11-06', 'Rental property — plumbing repair', 380.00, 'Investment Property', 'Home & Garden', 'Joint'),
  exp('e12', '2025-11-14', 'Coles — weekly shop', 187.30, 'Other Deductions', 'Groceries', 'Alex', { nonDeductible: true }),
  exp('e13', '2025-11-21', 'Aldi — weekly shop', 142.80, 'Other Deductions', 'Groceries', 'Alex', { nonDeductible: true }),
  exp('e14', '2025-12-03', 'Uber — airport', 62.40, 'Vehicle & Travel', 'Transport', 'Sam'),
  exp('e15', '2025-12-18', 'Netflix', 18.99, 'Other Deductions', 'Subscriptions', 'Joint', { nonDeductible: true }),
  exp('e16', '2026-01-08', 'Officeworks — printer ink', 54.00, 'Work from Home', 'Shopping', 'Sam'),
  exp('e17', '2026-01-22', 'Qantas — work conference Sydney', 389.00, 'Vehicle & Travel', 'Travel & Holidays', 'Sam'),
  exp('e18', '2026-02-05', 'Conference hotel — 2 nights', 412.00, 'Self-Education', 'Travel & Holidays', 'Sam'),
  exp('e19', '2026-02-14', 'Bupa — health insurance premium', 312.00, 'Other Deductions', 'Insurance', 'Joint', { nonDeductible: true }),
  exp('e20', '2026-02-27', 'Chartered Accountants — ethics CPD', 245.00, 'Self-Education', 'Education', 'Alex'),
  exp('e21', '2026-03-12', 'CommBank — home loan interest (Apr)', 1850.00, 'Investment Property', 'Financial & Banking', 'Joint'),
  exp('e22', '2026-03-19', 'Apple — iPhone work portion 80%', 1520.00, 'Phone & Internet', 'Shopping', 'Sam'),
  exp('e23', '2026-03-26', 'Cotton On — work clothing', 89.00, 'Clothing & Laundry', 'Shopping', 'Alex'),
  exp('e24', '2026-04-03', 'Reuters terminal subscription', 145.00, 'Investment Expenses', 'Subscriptions', 'Sam'),
  exp('e25', '2026-04-10', 'Spotlight — laundry bag, shoe polish', 38.50, 'Clothing & Laundry', 'Shopping', 'Alex'),
  exp('e26', '2026-04-15', 'Kmart — home office chair cushion', 29.00, 'Work from Home', 'Home & Garden', 'Sam'),
  exp('e27', '2025-04-02', 'ATO — prior year tax agent fee', 440.00, 'Other Deductions', 'Financial & Banking', 'Sam'),
  exp('e28', '2025-05-15', 'BP — fuel', 82.10, 'Vehicle & Travel', 'Transport', 'Alex'),
  exp('e29', '2025-06-10', 'Apple — last year laptop', 2899.00, 'Tools & Equipment', 'Shopping', 'Sam'),
  exp('e30', '2025-06-24', 'World Vision — monthly donation', 40.00, 'Donations', 'Gifts & Donations', 'Alex'),
];

const CATEGORY_RULES: CategoryRule[] = [
  { id: 'r1', pattern: 'coles', spendingCategory: 'Groceries', nonDeductible: true },
  { id: 'r2', pattern: 'aldi', spendingCategory: 'Groceries', nonDeductible: true },
  { id: 'r3', pattern: 'netflix', spendingCategory: 'Subscriptions', nonDeductible: true },
  { id: 'r4', pattern: 'shell', spendingCategory: 'Transport', taxCategory: 'Vehicle & Travel' },
  { id: 'r5', pattern: 'officeworks', spendingCategory: 'Home & Garden', taxCategory: 'Work from Home' },
  { id: 'r6', pattern: 'uber', spendingCategory: 'Transport', taxCategory: 'Vehicle & Travel' },
];

const ADVICE_CHATS: Record<string, ChatMessage[] | string[]> = {
  tax: [
    {
      role: 'model',
      text: `<h4>Diagnosis</h4>
<p>Your FY 2025-26 deduction portfolio is in <strong>healthy shape</strong> — across <strong>7 of 10</strong> ATO categories, with <strong>$8,200+</strong> in legitimate claims. The Work from Home, Self-Education, and Investment Property allocations are well-balanced for your combined software engineering + registered nurse household.</p>
<h5>Strengths</h5>
<ul>
<li><strong>Self-Education is working hard</strong> — $786 including the Sydney conference travel + hotel. Keep the substantiation: agenda, receipts, and link to current role.</li>
<li><strong>Investment Property interest deduction</strong> is correctly flagged ($1,850/mo — ensure you're only claiming the investment portion).</li>
<li>Sam's <strong>80% work-use iPhone ($1,216 deductible)</strong> is well-documented — maintain a 4-week usage diary if the ATO asks.</li>
</ul>
<h4>Prescription</h4>
<ol>
<li><strong>Claim home-office running costs</strong> — fixed-rate method (67c/hr) likely beats your current itemised claim given Sam's WFH pattern. Worth a ~$800 swing.</li>
<li><strong>Alex's laundry allowance</strong> — nurses can claim a standard $150/yr for uniform laundering without receipts. Add it.</li>
<li><strong>Super salary sacrifice</strong> — Sam's at $145k, 30% bracket. Sacrificing $5k concessional drops tax by $1,500. Cap is $30k/yr (incl. employer).</li>
<li><strong>CGT timing</strong> — VAS is up ~$6k. If you need to realise gains, split across FY boundaries or hold >12mo for the 50% discount.</li>
</ol>
<p><em>General advice only, not personal financial advice. Consult your registered tax agent for substantiation requirements.</em></p>`,
    },
  ],
  investments: [
    {
      role: 'model',
      text: `<h4>Diagnosis</h4>
<p>Portfolio sits at <strong>$338k</strong> with a <strong>$55.4k unrealised gain (+19.6%)</strong>. Diversification is <strong>reasonable but super-heavy (67%)</strong> and property-heavy at the household level (equity of $383k).</p>
<h5>Per-member tax position</h5>
<ul>
<li><strong>Sam (30% bracket + 2% Medicare)</strong>: Holds VAS ($45.9k), VGS ($28.4k), super ($142k). Realising all VAS gains today ≈ <strong>$970 CGT</strong> after 50% discount.</li>
<li><strong>Alex (30% bracket + 2% Medicare)</strong>: CBA shares ($15.8k, $3.5k gain). Realising ≈ <strong>$560 CGT</strong>.</li>
<li><strong>Joint — Brunswick IP</strong>: $175k unrealised gain. Each spouse would assess $87.5k × 50% discount × 32% = <strong>$14k CGT each</strong> if sold today.</li>
</ul>
<h4>Prescription</h4>
<ol>
<li><strong>Build defensive allocation</strong> — no bonds, and cash is only 2%. Consider $10-20k into VAF (AU bonds) or VDCO.</li>
<li><strong>Super concessional sacrifice</strong> — Sam has ~$12k headroom, Alex ~$20k. Pre-tax contribution beats post-tax for both.</li>
<li><strong>VGS over VAS for future deposits</strong> — you're 73% AU equities. VGS adds international exposure without currency hedging complexity.</li>
<li><strong>Property</strong> — negatively geared; interest deductible. Fine to hold; review equity release at next fixed-rate rollover.</li>
</ol>
<p><em>General advice only. Not personal financial advice — consult a licensed adviser for your circumstances.</em></p>`,
    },
  ],
  'custom-spending-categories': ['Date Night', 'Vet'],
};

export const GUEST_SEED: GuestSeed = {
  familyMembers: FAMILY,
  expenses: EXPENSES,
  investments: INVESTMENTS,
  categoryRules: CATEGORY_RULES,
  adviceChats: ADVICE_CHATS,
};
