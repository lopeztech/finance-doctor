import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';
import type { Expense } from '@/lib/types';

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

function parseCSV(text: string): { date: string; description: string; amount: number }[] {
  const lines = text.trim().split('\n');
  if (lines.length < 1) return [];

  // Detect header row — only if first row contains known header keywords
  const firstRowCols = splitCSVLine(lines[0]);
  const firstRowLower = firstRowCols.map(c => c.toLowerCase().trim());
  const hasHeader = firstRowLower.some(c => c.includes('date')) &&
    (firstRowLower.some(c => c.includes('description') || c.includes('narration') || c.includes('memo') || c.includes('amount') || c.includes('debit')));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const results: { date: string; description: string; amount: number }[] = [];

  // Default layout: Date, Amount, Description, Additional Description...
  let dateCol = 0;
  let amountCol = 1;
  let descCols: number[] = [2, 3]; // Merge cols 2+ as description by default

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
    // Merge all description columns
    const description = descCols
      .map(i => cols[i]?.trim())
      .filter(Boolean)
      .join(' — ');
    const rawAmount = cols[amountCol]?.trim().replace(/[,$"]/g, '');

    if (!rawDate || !description || !rawAmount) continue;

    const amount = Math.abs(parseFloat(rawAmount));
    if (isNaN(amount) || amount === 0) continue;

    // Normalise date to YYYY-MM-DD
    const date = normaliseDate(rawDate);
    if (!date) continue;

    results.push({ date, description, amount });
  }

  return results;
}

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

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  // AU FY: Jul 1 to Jun 30 — Jul-Dec = current/next, Jan-Jun = prev/current
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function normaliseDate(raw: string): string | null {
  // Try DD/MM/YYYY or DD-MM-YYYY (Australian format)
  let match = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return raw;
  // Try DD/MM/YY
  match = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (match) {
    const [, day, month, shortYear] = match;
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const db = getDb();
    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV. Expected columns: Date, Description, Amount' }, { status: 400 });
    }

    // Load saved category rules
    const rulesSnapshot = await db.collection('users').doc(userId).collection('category-rules').get();
    const rules = rulesSnapshot.docs.map(doc => doc.data() as { pattern: string; taxCategory?: string; spendingCategory?: string });

    // Find matching rule for a description
    const findRule = (description: string) => {
      const lower = description.toLowerCase();
      return rules.find(r => lower.includes(r.pattern));
    };

    // Only send to Gemini expenses without a matching rule
    const needsAI = parsed.filter((p, i) => { const r = findRule(p.description); return !r || (!r.taxCategory && !r.spendingCategory); });
    const aiIndexMap = new Map<number, number>(); // maps AI index back to parsed index
    let aiIdx = 0;
    parsed.forEach((p, i) => { const r = findRule(p.description); if (!r || (!r.taxCategory && !r.spendingCategory)) { aiIndexMap.set(aiIdx++, i); } });

    // Categorise with Gemini (only items without rules)
    const descriptions = needsAI.map((p, i) => `${i}. "${p.description}" ($${p.amount.toFixed(2)})`).join('\n');
    const prompt = needsAI.length > 0 ? `Categorise these ${needsAI.length} expense transactions:\n${descriptions}` : '';

    // Build category lookups — start with rules
    const categoryMap = new Map<number, string>();
    const spendingCategoryMap = new Map<number, string>();

    // Apply saved rules first
    parsed.forEach((p, i) => {
      const rule = findRule(p.description);
      if (rule?.taxCategory) categoryMap.set(i, rule.taxCategory);
      if (rule?.spendingCategory) spendingCategoryMap.set(i, rule.spendingCategory);
    });

    // Call Gemini for items without rules
    if (needsAI.length > 0) {
      const model = await getGeminiModel();
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

    // Check for duplicates against all existing expenses
    const existingSnapshot = await db
      .collection('users').doc(userId)
      .collection('expenses')
      .get();

    const existingSet = new Set(
      existingSnapshot.docs.map(doc => {
        const d = doc.data();
        return `${d.date}|${d.description}|${d.amount}`;
      })
    );

    // Return preview — derive FY from each expense's date
    const preview = parsed.map((p, i) => ({
      date: p.date,
      description: p.description,
      amount: p.amount,
      category: categoryMap.get(i) || 'Other Deductions',
      spendingCategory: spendingCategoryMap.get(i) || 'Other',
      financialYear: getFinancialYear(p.date),
      duplicate: existingSet.has(`${p.date}|${p.description}|${p.amount}`),
    }));

    const duplicateCount = preview.filter(p => p.duplicate).length;
    return NextResponse.json({ preview, total: preview.length, duplicateCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('CSV import error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Confirm and save the previewed expenses
export async function PUT(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { expenses: expenseData } = await req.json() as { expenses: Omit<Expense, 'id'>[] };
    if (!expenseData?.length) {
      return NextResponse.json({ error: 'No expenses to save' }, { status: 400 });
    }

    const db = getDb();
    const batch = db.batch();
    const saved: Expense[] = [];

    for (const data of expenseData) {
      const { duplicate: _dup, owner, ...rest } = data as Record<string, unknown>;
      const ref = db.collection('users').doc(userId).collection('expenses').doc();
      const expense: Expense = {
        id: ref.id,
        date: rest.date as string,
        description: rest.description as string,
        amount: rest.amount as number,
        category: rest.category as string,
        ...(rest.spendingCategory ? { spendingCategory: rest.spendingCategory as string } : {}),
        financialYear: rest.financialYear as string,
        ...(owner ? { owner: owner as string } : {}),
      };
      batch.set(ref, expense);
      saved.push(expense);
    }

    await batch.commit();
    return NextResponse.json({ saved, total: saved.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('CSV confirm error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
