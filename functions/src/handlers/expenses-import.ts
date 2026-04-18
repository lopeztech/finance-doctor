import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
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

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  explicitCategory?: string;
  explicitDeductible?: boolean;
}

function parseBoolean(raw: string): boolean | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (['true', 'yes', 'y', '1', 'deductible', 'tax deductible'].includes(v)) return true;
  if (['false', 'no', 'n', '0', 'non-deductible', 'nondeductible', 'not deductible', 'non deductible'].includes(v)) return false;
  return undefined;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 1) return [];

  const firstRowCols = splitCSVLine(lines[0]);
  const firstRowLower = firstRowCols.map(c => c.toLowerCase().trim());
  const hasHeader = firstRowLower.some(c => c.includes('date')) &&
    (firstRowLower.some(c => c.includes('description') || c.includes('narration') || c.includes('memo') || c.includes('amount') || c.includes('debit')));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const results: ParsedRow[] = [];

  let dateCol = 0;
  let amountCol = 1;
  let descCols: number[] = [2, 3];
  let categoryCol = -1;
  let deductibleCol = -1;

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

    deductibleCol = firstRowLower.findIndex(c => c.includes('deductible'));
    categoryCol = firstRowLower.findIndex((c, i) => c === 'category' || (c.includes('category') && i !== deductibleCol && !c.includes('sub')));
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

    const explicitCategory = categoryCol >= 0 ? cols[categoryCol]?.trim() || undefined : undefined;
    const explicitDeductible = deductibleCol >= 0 ? parseBoolean(cols[deductibleCol] || '') : undefined;

    results.push({ date, description, amount, explicitCategory, explicitDeductible });
  }

  return results;
}

export const expensesImport = onCall<ExpensesImportData>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<ExpensesImportData>) => {
    const start = Date.now();
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

      // Per-row resolved values. Priority: explicit CSV column > saved rule > AI.
      const categoryMap = new Map<number, string>();
      const spendingCategoryMap = new Map<number, string>();
      const spendingSubCategoryMap = new Map<number, string>();
      const nonDeductibleMap = new Map<number, boolean>();
      const newRules: { pattern: string; taxCategory?: string; spendingCategory?: string; nonDeductible?: boolean }[] = [];

      parsed.forEach((p, i) => {
        // 1. Explicit Tax Deductible column
        if (p.explicitDeductible === false) {
          nonDeductibleMap.set(i, true);
          // Non-deductible rows go into the Other Deductions tax bucket by convention
          categoryMap.set(i, 'Other Deductions');
        }

        // 2. Explicit Category column — match against tax, then spending, then treat as custom spending
        if (p.explicitCategory) {
          const exact = CATEGORIES.find(c => c.toLowerCase() === p.explicitCategory!.toLowerCase());
          const exactSpending = SPENDING_CATEGORIES.find(c => c.toLowerCase() === p.explicitCategory!.toLowerCase());
          if (exact) {
            if (!nonDeductibleMap.has(i)) categoryMap.set(i, exact);
          } else if (exactSpending) {
            spendingCategoryMap.set(i, exactSpending);
          } else {
            // Treat as a custom spending category (user-defined, e.g. "Kids")
            spendingCategoryMap.set(i, p.explicitCategory);
          }
        }

        // Capture a rule to persist for future imports when anything was explicit
        if (p.explicitCategory || p.explicitDeductible !== undefined) {
          newRules.push({
            pattern: p.description.toLowerCase(),
            ...(categoryMap.get(i) ? { taxCategory: categoryMap.get(i) } : {}),
            ...(spendingCategoryMap.get(i) ? { spendingCategory: spendingCategoryMap.get(i) } : {}),
            ...(p.explicitDeductible === false ? { nonDeductible: true } : {}),
          });
        }

        // 3. Existing saved rules — only fill gaps
        const rule = findRule(p.description);
        if (rule?.taxCategory && !categoryMap.has(i)) categoryMap.set(i, rule.taxCategory);
        if (rule?.spendingCategory && !spendingCategoryMap.has(i)) spendingCategoryMap.set(i, rule.spendingCategory);
        if (rule?.spendingSubCategory && !spendingSubCategoryMap.has(i)) spendingSubCategoryMap.set(i, rule.spendingSubCategory);
        if (rule?.nonDeductible && !nonDeductibleMap.has(i)) {
          nonDeductibleMap.set(i, true);
          if (!categoryMap.has(i)) categoryMap.set(i, 'Other Deductions');
        }
      });

      // 4. AI fills what's still missing. A row needs AI if any of: tax category (unless non-deductible) or spending category is absent.
      const needsAI: { row: ParsedRow; idx: number }[] = [];
      parsed.forEach((p, i) => {
        const needsTax = !nonDeductibleMap.get(i) && !categoryMap.has(i);
        const needsSpending = !spendingCategoryMap.has(i);
        if (needsTax || needsSpending) needsAI.push({ row: p, idx: i });
      });

      if (needsAI.length > 0) {
        const descriptions = needsAI.map(({ row }, i) => `${i}. "${row.description}" ($${row.amount.toFixed(2)})`).join('\n');
        const prompt = `Categorise these ${needsAI.length} expense transactions:\n${descriptions}`;
        const model = getGeminiModel();
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
        });

        const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

        let aiCategories: { index: number; category: string; spendingCategory?: string }[] = [];
        try {
          aiCategories = JSON.parse(cleaned);
        } catch {
          aiCategories = needsAI.map((_, i) => ({ index: i, category: 'Other Deductions' }));
        }

        for (const cat of aiCategories) {
          const entry = needsAI[cat.index];
          if (!entry) continue;
          const origIdx = entry.idx;
          if (!categoryMap.has(origIdx)) categoryMap.set(origIdx, CATEGORIES.includes(cat.category) ? cat.category : 'Other Deductions');
          if (!spendingCategoryMap.has(origIdx)) spendingCategoryMap.set(origIdx, SPENDING_CATEGORIES.includes(cat.spendingCategory || '') ? cat.spendingCategory! : 'Other');
        }
      }

      // Persist rules derived from explicit columns (one per unique description)
      if (newRules.length > 0) {
        const seenPatterns = new Set<string>();
        const ruleCol = db.collection('users').doc(email).collection('category-rules');
        const ruleBatch = db.batch();
        let wrote = 0;
        for (const r of newRules) {
          if (seenPatterns.has(r.pattern)) continue;
          seenPatterns.add(r.pattern);
          const ref = ruleCol.doc();
          ruleBatch.set(ref, { id: ref.id, ...r });
          wrote++;
        }
        if (wrote > 0) await ruleBatch.commit();
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
      const explicitCount = parsed.filter(p => p.explicitCategory || p.explicitDeductible !== undefined).length;
      auditLog({
        endpoint: 'expensesImport',
        email,
        durationMs: Date.now() - start,
        action: 'preview',
        geminiCalled: needsAI.length > 0,
        rowCount: parsed.length,
        explicitRowCount: explicitCount,
        aiCategorised: needsAI.length,
        ruleCategorised: parsed.length - needsAI.length - explicitCount,
        duplicateCount,
      });
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
      auditLog({
        endpoint: 'expensesImport',
        email,
        durationMs: Date.now() - start,
        action: 'save',
        geminiCalled: false,
        savedCount: saved.length,
      });
      return { saved, total: saved.length };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
