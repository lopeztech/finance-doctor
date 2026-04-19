import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { PubSub } from '@google-cloud/pubsub';
import { getDb } from '../lib/firestore';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import { categoriseBatch, TAX_CATEGORIES as CATEGORIES, SPENDING_CATEGORIES } from '../lib/categorise';
import type { Expense } from '../lib/types';
import { EXPENSE_CATEGORISE_TOPIC, type CategoriseMessage } from './expenses-categorise-worker';

// Imports above this row-count categorise synchronously at preview time so the
// user can review AI-picked categories before confirming. Above it we skip the
// preview-time AI call (risk of timeout / huge prompt) and fan out to the
// Pub/Sub worker after save.
const ASYNC_CATEGORISE_THRESHOLD = 50;

interface PreviewData {
  action: 'preview';
  csvText: string;
}

interface SaveData {
  action: 'save';
  expenses: Omit<Expense, 'id'>[];
}

type ExpensesImportData = PreviewData | SaveData;

let pubsubClient: PubSub | null = null;
function getPubSub(): PubSub {
  if (!pubsubClient) pubsubClient = new PubSub();
  return pubsubClient;
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
        if (p.explicitDeductible === false) {
          nonDeductibleMap.set(i, true);
          categoryMap.set(i, 'Other Deductions');
        }

        if (p.explicitCategory) {
          const exact = CATEGORIES.find(c => c.toLowerCase() === p.explicitCategory!.toLowerCase());
          const exactSpending = SPENDING_CATEGORIES.find(c => c.toLowerCase() === p.explicitCategory!.toLowerCase());
          if (exact) {
            if (!nonDeductibleMap.has(i)) categoryMap.set(i, exact);
          } else if (exactSpending) {
            spendingCategoryMap.set(i, exactSpending);
          } else {
            spendingCategoryMap.set(i, p.explicitCategory);
          }
        }

        if (p.explicitCategory || p.explicitDeductible !== undefined) {
          newRules.push({
            pattern: p.description.toLowerCase(),
            ...(categoryMap.get(i) ? { taxCategory: categoryMap.get(i) } : {}),
            ...(spendingCategoryMap.get(i) ? { spendingCategory: spendingCategoryMap.get(i) } : {}),
            ...(p.explicitDeductible === false ? { nonDeductible: true } : {}),
          });
        }

        const rule = findRule(p.description);
        if (rule?.taxCategory && !categoryMap.has(i)) categoryMap.set(i, rule.taxCategory);
        if (rule?.spendingCategory && !spendingCategoryMap.has(i)) spendingCategoryMap.set(i, rule.spendingCategory);
        if (rule?.spendingSubCategory && !spendingSubCategoryMap.has(i)) spendingSubCategoryMap.set(i, rule.spendingSubCategory);
        if (rule?.nonDeductible && !nonDeductibleMap.has(i)) {
          nonDeductibleMap.set(i, true);
          if (!categoryMap.has(i)) categoryMap.set(i, 'Other Deductions');
        }
      });

      // Rows that still need AI (either category or spendingCategory unresolved)
      const needsAI: { row: ParsedRow; idx: number }[] = [];
      parsed.forEach((p, i) => {
        const needsTax = !nonDeductibleMap.get(i) && !categoryMap.has(i);
        const needsSpending = !spendingCategoryMap.has(i);
        if (needsTax || needsSpending) needsAI.push({ row: p, idx: i });
      });

      // Small imports: categorise synchronously so user reviews AI picks before save.
      // Large imports: defer to post-save Pub/Sub fan-out (flag with awaitingCategorisation).
      const deferCategorisation = parsed.length > ASYNC_CATEGORISE_THRESHOLD;
      let aiCategorisedCount = 0;

      if (needsAI.length > 0 && !deferCategorisation) {
        const results = await categoriseBatch(needsAI.map(({ row }) => ({ description: row.description, amount: row.amount })));
        results.forEach((r, i) => {
          const origIdx = needsAI[i].idx;
          if (!categoryMap.has(origIdx)) categoryMap.set(origIdx, r.category);
          if (!spendingCategoryMap.has(origIdx)) spendingCategoryMap.set(origIdx, r.spendingCategory);
        });
        aiCategorisedCount = needsAI.length;
      }

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

      const needsAISet = new Set(needsAI.map(n => n.idx));

      const preview = parsed.map((p, i) => {
        const awaitingCategorisation = deferCategorisation && needsAISet.has(i);
        return {
          date: p.date,
          description: p.description,
          amount: p.amount,
          category: categoryMap.get(i) || 'Other Deductions',
          spendingCategory: spendingCategoryMap.get(i) || 'Other',
          ...(spendingSubCategoryMap.get(i) ? { spendingSubCategory: spendingSubCategoryMap.get(i) } : {}),
          ...(nonDeductibleMap.get(i) ? { nonDeductible: true } : {}),
          financialYear: getFinancialYear(p.date),
          duplicate: existingSet.has(`${p.date}|${p.description}|${p.amount}`),
          ...(awaitingCategorisation ? { awaitingCategorisation: true } : {}),
        };
      });

      const duplicateCount = preview.filter(p => p.duplicate).length;
      const explicitCount = parsed.filter(p => p.explicitCategory || p.explicitDeductible !== undefined).length;
      auditLog({
        endpoint: 'expensesImport',
        email,
        durationMs: Date.now() - start,
        action: 'preview',
        geminiCalled: aiCategorisedCount > 0,
        rowCount: parsed.length,
        explicitRowCount: explicitCount,
        aiCategorised: aiCategorisedCount,
        ruleCategorised: parsed.length - needsAI.length - explicitCount,
        duplicateCount,
        deferredCategorisation: deferCategorisation ? needsAI.length : 0,
      });
      return {
        preview,
        total: preview.length,
        duplicateCount,
        deferredCategorisation: deferCategorisation ? needsAI.length : 0,
      };
    }

    if (request.data.action === 'save') {
      const { expenses: expenseData } = request.data;
      if (!expenseData?.length) {
        throw new HttpsError('invalid-argument', 'No expenses to save.');
      }

      const batch = db.batch();
      const saved: Expense[] = [];
      const toCategorise: CategoriseMessage[] = [];

      for (const data of expenseData) {
        const { duplicate: _dup, owner, awaitingCategorisation, ...rest } = data as Record<string, unknown>;
        const ref = db.collection('users').doc(email).collection('expenses').doc();
        const needsAsyncCategorisation = Boolean(awaitingCategorisation);
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
          ...(needsAsyncCategorisation ? { categorisationStatus: 'pending' as const } : {}),
        };
        batch.set(ref, expense);
        saved.push(expense);

        if (needsAsyncCategorisation) {
          toCategorise.push({
            email,
            expenseId: ref.id,
            description: expense.description,
            amount: expense.amount,
          });
        }
      }

      await batch.commit();

      let published = 0;
      if (toCategorise.length > 0) {
        const topic = getPubSub().topic(EXPENSE_CATEGORISE_TOPIC);
        const results = await Promise.allSettled(
          toCategorise.map(msg => topic.publishMessage({ json: msg })),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') published++;
          else logger.error('Failed to publish categorise message', { error: r.reason });
        }
      }

      auditLog({
        endpoint: 'expensesImport',
        email,
        durationMs: Date.now() - start,
        action: 'save',
        geminiCalled: false,
        savedCount: saved.length,
        enqueuedForCategorisation: published,
      });
      return { saved, total: saved.length, enqueuedForCategorisation: published };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
