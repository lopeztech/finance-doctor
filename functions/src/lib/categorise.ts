import { getGeminiModel } from './gemini';

export const TAX_CATEGORIES = [
  'Work from Home',
  'Vehicle & Travel',
  'Clothing & Laundry',
  'Self-Education',
  'Tools & Equipment',
  'Professional Memberships',
  'Phone & Internet',
  'Donations',
  'Investment Expenses',
  'Investment Property',
  'Other Deductions',
];

export const SPENDING_CATEGORIES = [
  'Groceries',
  'Dining & Takeaway',
  'Transport',
  'Utilities & Bills',
  'Shopping',
  'Healthcare',
  'Entertainment',
  'Subscriptions',
  'Education',
  'Insurance',
  'Home & Garden',
  'Personal Care',
  'Travel & Holidays',
  'Gifts & Donations',
  'Financial & Banking',
  'Cafe',
  'Bakery',
  'Car',
  'Personal Project',
  'Kids Entertainment',
  'Other',
];

export const CATEGORISE_PROMPT = `You are an Australian financial categorisation engine.
Given a list of expense transactions, categorise each one into:
1. A TAX deduction category (for ATO tax purposes)
2. A SPENDING category (for personal budgeting)

TAX categories (use exactly these names):
${TAX_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

SPENDING categories (use exactly these names):
${SPENDING_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rules:
- Return a JSON array: [{"index": 0, "category": "tax category name", "spendingCategory": "spending category name"}]
- Use ONLY the exact category names listed above
- If unsure about tax category, use "Other Deductions"
- If unsure about spending category, use "Other"
- Consider Australian context — e.g. "Coles" is "Groceries", "Uber" is "Transport", "Netflix" is "Subscriptions"
- Do NOT wrap in markdown code fences, return raw JSON only
- The index must match the position in the input array (0-based)`;

export interface CategoriseInput {
  description: string;
  amount: number;
}

export interface CategoriseOutput {
  category: string;
  spendingCategory: string;
}

export async function categoriseBatch(items: CategoriseInput[]): Promise<CategoriseOutput[]> {
  if (items.length === 0) return [];

  const descriptions = items.map((row, i) => `${i}. "${row.description}" ($${row.amount.toFixed(2)})`).join('\n');
  const prompt = `Categorise these ${items.length} expense transactions:\n${descriptions}`;

  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
  });

  const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  let parsed: { index: number; category: string; spendingCategory?: string }[] = [];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fall through — emit safe defaults for all rows
  }

  const out: CategoriseOutput[] = items.map(() => ({ category: 'Other Deductions', spendingCategory: 'Other' }));
  for (const p of parsed) {
    if (typeof p.index !== 'number' || p.index < 0 || p.index >= items.length) continue;
    out[p.index] = {
      category: TAX_CATEGORIES.includes(p.category) ? p.category : 'Other Deductions',
      spendingCategory: SPENDING_CATEGORIES.includes(p.spendingCategory || '') ? p.spendingCategory! : 'Other',
    };
  }
  return out;
}
