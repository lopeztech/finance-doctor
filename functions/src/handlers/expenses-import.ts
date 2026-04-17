import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import type { Expense } from '../lib/types';

const CATEGORIES = [
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

const SPENDING_CATEGORIES = [
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

const CATEGORISE_PROMPT = `You are an Australian financial categorisation engine.
Given a list of expense transactions, categorise each one into:
1. A TAX deduction category (for ATO tax purposes)
2. A SPENDING category (for personal budgeting)

TAX categories (use exactly these names):
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

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

interface PreviewData {
  action: 'preview';
  csvText: string;
}

interface SaveData {
  action: 'save';
  expenses: Omit<Expense, 'id'>[];
}

type ExpensesImportData = PreviewData | SaveData;

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normaliseDate(raw: string): string | null {
  let match = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return raw;
  match = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (match) {
    const [, day, month, shortYear] = match;
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function parseCSV(text: string): { date: string; description: string; amount: number }[] {
  const lines = text.trim().split('\n');
  if (lines.length < 1) return [];

  const firstRowCols = splitCSVLine(lines[0]);
  const firstRowLower = firstRowCols.map(c => c.toLowerCase().trim());
  const hasHeader = firstRowLower.some(c => c.includes('date')) &&
    (firstRowLower.some(c => c.includes('description') || c.includes('narration') || c.includes('memo') || c.includes('amount') || c.includes('debit')));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const results: { date: string; description: string; amount: number }[] = [];

  let dateCol = 0;
  let amountCol = 1;
  let descCols: number[] = [2, 3];

  if (hasHeader) {
    const dateIdx = firstRowLower.findIndex(c => c.includes('date'));
    const amountIdx = firstRowLower.findIndex(c => c.includes('amount') || c.includes('debit') || c.includes('value'));

    const headerDescCols: number[] = [];
    firstRowLower.forEach((c, i) => {
      if (c.includes('description') || c.includes('narration') || c.includes('memo') || c.includes('details') || c.includes('transaction')) {
        headerDescCols.push(i);
      }
    });

    if (dateIdx >= 0) dateCol = dateIdx;
    if (amountIdx >= 0) amountCol = amountIdx;
    if (headerDescCols.length > 0) descCols = headerDescCols;
  }

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = splitCSVLine(line);
    if (cols.length < 3) continue;

    const rawDate = cols[dateCol]?.trim();
    const description = descCols
      .map(i => cols[i]?.trim())
      .filter(Boolean)
      .join(' — ');
    const rawAmount = cols[amountCol]?.trim().replace(/[,$"]/g, '');

    if (!rawDate || !description || !rawAmount) continue;

    const amount = Math.abs(parseFloat(rawAmount));
    if (isNaN(amount) || amount === 0) continue;

    const date = normaliseDate(rawDate);
    if (!date) continue;

    results.push({ date, description, amount });
  }

  return results;
}

export const expensesImport = onCall<ExpensesImportData>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions' },
  async (request: CallableRequest<ExpensesImportData>) => {
    const email = requireUserEmail(request);
    const db = getDb();

    if (request.data.action === 'preview') {
      const { csvText } = request.data;
      if (!csvText) throw new HttpsError('invalid-argument', 'No CSV content provided.');

      const parsed = parseCSV(csvText);
      if (parsed.length === 0) {
        throw new HttpsError('invalid-argument', 'No valid rows found in CSV. Expected columns: Date, Description, Amount');
      }

      const rulesSnap = await db.collection('users').doc(email).collection('category-rules').get();
      const rules = rulesSnap.docs.map(d => d.data() as { pattern: string; taxCategory?: string; spendingCategory?: string; spendingSubCategory?: string; nonDeductible?: boolean });

      const findRule = (description: string) => {
        const lower = description.toLowerCase();
        return rules.find(r => lower.includes(r.pattern));
      };

      const needsAI = parsed.filter(p => { const r = findRule(p.description); return !r || (!r.taxCategory && !r.spendingCategory); });
      const aiIndexMap = new Map<number, number>();
      let aiIdx = 0;
      parsed.forEach((p, i) => { const r = findRule(p.description); if (!r || (!r.taxCategory && !r.spendingCategory)) { aiIndexMap.set(aiIdx++, i); } });

      const descriptions = needsAI.map((p, i) => `${i}. "${p.description}" ($${p.amount.toFixed(2)})`).join('\n');
      const prompt = needsAI.length > 0 ? `Categorise these ${needsAI.length} expense transactions:\n${descriptions}` : '';

      const categoryMap = new Map<number, string>();
      const spendingCategoryMap = new Map<number, string>();
      const spendingSubCategoryMap = new Map<number, string>();
      const nonDeductibleMap = new Map<number, boolean>();

      parsed.forEach((p, i) => {
        const rule = findRule(p.description);
        if (rule?.taxCategory) categoryMap.set(i, rule.taxCategory);
        if (rule?.spendingCategory) spendingCategoryMap.set(i, rule.spendingCategory);
        if (rule?.spendingSubCategory) spendingSubCategoryMap.set(i, rule.spendingSubCategory);
        if (rule?.nonDeductible) nonDeductibleMap.set(i, true);
      });

      if (needsAI.length > 0) {
        const model = getGeminiModel();
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
        });

        const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

        let categories: { index: number; category: string; spendingCategory?: string }[] = [];
        try {
          categories = JSON.parse(cleaned);
        } catch {
          categories = needsAI.map((_, i) => ({ index: i, category: 'Other Deductions' }));
        }

        for (const cat of categories) {
          const origIdx = aiIndexMap.get(cat.index);
          if (origIdx === undefined) continue;
          if (!categoryMap.has(origIdx)) categoryMap.set(origIdx, CATEGORIES.includes(cat.category) ? cat.category : 'Other Deductions');
          if (!spendingCategoryMap.has(origIdx)) spendingCategoryMap.set(origIdx, SPENDING_CATEGORIES.includes(cat.spendingCategory || '') ? cat.spendingCategory! : 'Other');
        }
      }

      const existingSnap = await db.collection('users').doc(email).collection('expenses').get();
      const existingSet = new Set(existingSnap.docs.map(d => {
        const data = d.data();
        return `${data.date}|${data.description}|${data.amount}`;
      }));

      const preview = parsed.map((p, i) => ({
        date: p.date,
        description: p.description,
        amount: p.amount,
        category: categoryMap.get(i) || 'Other Deductions',
        spendingCategory: spendingCategoryMap.get(i) || 'Other',
        ...(spendingSubCategoryMap.get(i) ? { spendingSubCategory: spendingSubCategoryMap.get(i) } : {}),
        ...(nonDeductibleMap.get(i) ? { nonDeductible: true } : {}),
        financialYear: getFinancialYear(p.date),
        duplicate: existingSet.has(`${p.date}|${p.description}|${p.amount}`),
      }));

      const duplicateCount = preview.filter(p => p.duplicate).length;
      return { preview, total: preview.length, duplicateCount };
    }

    if (request.data.action === 'save') {
      const { expenses: expenseData } = request.data;
      if (!expenseData?.length) {
        throw new HttpsError('invalid-argument', 'No expenses to save.');
      }

      const batch = db.batch();
      const saved: Expense[] = [];

      for (const data of expenseData) {
        const { duplicate: _dup, owner, ...rest } = data as Record<string, unknown>;
        const ref = db.collection('users').doc(email).collection('expenses').doc();
        const expense: Expense = {
          id: ref.id,
          date: rest.date as string,
          description: rest.description as string,
          amount: rest.amount as number,
          category: rest.category as string,
          ...(rest.spendingCategory ? { spendingCategory: rest.spendingCategory as string } : {}),
          ...(rest.spendingSubCategory ? { spendingSubCategory: rest.spendingSubCategory as string } : {}),
          financialYear: rest.financialYear as string,
          ...(owner ? { owner: owner as string } : {}),
          ...(rest.nonDeductible ? { nonDeductible: true } : {}),
        };
        batch.set(ref, expense);
        saved.push(expense);
      }

      await batch.commit();
      return { saved, total: saved.length };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
