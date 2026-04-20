import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import type { Income, IncomeType } from '../lib/types';
import { INCOME_TYPES } from '../lib/types';

// Loose aliases accepted in the Type column (case-insensitive).
const TYPE_ALIASES: Record<string, IncomeType> = {
  'salary': 'Salary',
  'wages': 'Salary',
  'pay': 'Salary',
  'dividend': 'Dividend',
  'dividends': 'Dividend',
  'interest': 'Interest',
  'side income': 'Side Income',
  'side': 'Side Income',
  'other income': 'Other Income',
  'other': 'Other Income',
  'rental': 'Rental',
  'rent': 'Rental',
};

interface PreviewRowOut {
  date: string;
  description: string;
  amount: number;
  type: IncomeType;
  financialYear: string;
  owner?: string;
  duplicate: boolean;
  error?: string;
}

interface PreviewData {
  action: 'preview';
  csvText: string;
  owner?: string;
}

interface SaveData {
  action: 'save';
  rows: Omit<Income, 'id'>[];
}

type CashflowImportData = PreviewData | SaveData;

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

function normaliseDate(raw: string): string | null {
  const s = (raw || '').trim();
  let m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) { const [, d, mo, y] = m; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (m) { const [, d, mo, sh] = m; const y = parseInt(sh) > 50 ? `19${sh}` : `20${sh}`; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  return null;
}

function getFinancialYear(date: string): string {
  const [yStr, moStr] = date.split('-');
  const y = parseInt(yStr);
  const mo = parseInt(moStr);
  if (mo >= 7) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

function parseAmount(raw: string): number {
  return Math.abs(parseFloat((raw || '').replace(/[,$"]/g, '')));
}

interface ParsedRow {
  rawDate: string;
  description: string;
  rawAmount: string;
  rawType: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const firstRow = splitCSVLine(lines[0]).map(c => c.trim().toLowerCase());
  const hasHeader = firstRow.some(c => c.includes('date')) && firstRow.some(c => c.includes('amount'));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let dateCol = 0, amountCol = 1, descCol = 2, typeCol = 3;
  if (hasHeader) {
    const dIdx = firstRow.findIndex(c => c.includes('date'));
    const aIdx = firstRow.findIndex(c => c.includes('amount') || c.includes('value'));
    const descIdx = firstRow.findIndex(c => c.includes('description') || c.includes('narration') || c.includes('memo') || c.includes('details'));
    const tIdx = firstRow.findIndex(c => c === 'type' || c.includes('income type') || c.includes(' type'));
    if (dIdx >= 0) dateCol = dIdx;
    if (aIdx >= 0) amountCol = aIdx;
    if (descIdx >= 0) descCol = descIdx;
    if (tIdx >= 0) typeCol = tIdx;
  }

  return dataLines.map(line => {
    const cols = splitCSVLine(line);
    return {
      rawDate: cols[dateCol] || '',
      description: (cols[descCol] || '').trim(),
      rawAmount: cols[amountCol] || '',
      rawType: (cols[typeCol] || '').trim(),
    };
  });
}

export const cashflowImport = onCall<CashflowImportData>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<CashflowImportData>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const db = getDb();

    if (request.data.action === 'preview') {
      const { csvText, owner } = request.data;
      if (!csvText) throw new HttpsError('invalid-argument', 'No CSV content provided.');

      const parsed = parseCSV(csvText);
      if (parsed.length === 0) {
        throw new HttpsError('invalid-argument', 'No valid rows found. Expected columns: Date, Amount, Description, Type');
      }

      const existingSnap = await db.collection('users').doc(email).collection('income').get();
      const existingSet = new Set(existingSnap.docs.map(d => {
        const data = d.data();
        return `${data.date}|${data.description}|${data.amount}|${data.owner || ''}`;
      }));

      const preview: PreviewRowOut[] = [];
      for (const row of parsed) {
        const date = normaliseDate(row.rawDate);
        const amount = parseAmount(row.rawAmount);
        const typeKey = row.rawType.toLowerCase();
        const type = TYPE_ALIASES[typeKey] || (INCOME_TYPES.find(t => t.toLowerCase() === typeKey) as IncomeType | undefined);

        if (!date) {
          preview.push({ date: row.rawDate, description: row.description, amount: 0, type: 'Other Income', financialYear: '', owner, duplicate: false, error: 'Invalid or missing Date' });
          continue;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          preview.push({ date, description: row.description, amount: 0, type: type || 'Other Income', financialYear: getFinancialYear(date), owner, duplicate: false, error: 'Invalid or missing Amount' });
          continue;
        }
        if (!row.description) {
          preview.push({ date, description: '', amount, type: type || 'Other Income', financialYear: getFinancialYear(date), owner, duplicate: false, error: 'Missing Description' });
          continue;
        }
        if (!type) {
          preview.push({ date, description: row.description, amount, type: 'Other Income', financialYear: getFinancialYear(date), owner, duplicate: false, error: `Unknown Type "${row.rawType}"` });
          continue;
        }

        const dupKey = `${date}|${row.description}|${amount}|${owner || ''}`;
        preview.push({
          date,
          description: row.description,
          amount,
          type,
          financialYear: getFinancialYear(date),
          ...(owner ? { owner } : {}),
          duplicate: existingSet.has(dupKey),
        });
      }

      const duplicateCount = preview.filter(p => p.duplicate).length;
      const errorCount = preview.filter(p => p.error).length;
      auditLog({
        endpoint: 'cashflowImport', email, durationMs: Date.now() - start, action: 'preview',
        rowCount: parsed.length, duplicateCount, errorCount,
      });
      return { preview, total: preview.length, duplicateCount, errorCount };
    }

    if (request.data.action === 'save') {
      const { rows } = request.data;
      if (!rows?.length) throw new HttpsError('invalid-argument', 'No rows to save.');

      const batch = db.batch();
      const saved: Income[] = [];
      for (const data of rows) {
        const ref = db.collection('users').doc(email).collection('income').doc();
        const income: Income = {
          id: ref.id,
          date: data.date,
          description: data.description,
          amount: data.amount,
          type: data.type,
          financialYear: data.financialYear || getFinancialYear(data.date),
          ...(data.owner ? { owner: data.owner } : {}),
        };
        batch.set(ref, income);
        saved.push(income);
      }
      await batch.commit();

      auditLog({
        endpoint: 'cashflowImport', email, durationMs: Date.now() - start, action: 'save',
        savedCount: saved.length,
      });
      return { saved, total: saved.length };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
