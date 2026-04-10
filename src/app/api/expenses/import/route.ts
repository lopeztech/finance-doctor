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

const CATEGORISE_PROMPT = `You are an Australian tax categorisation engine.
Given a list of expense transactions, categorise each one into exactly one of these ATO deduction categories:
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rules:
- Return a JSON array of objects: [{"index": 0, "category": "exact category name"}]
- Use ONLY the exact category names listed above
- If unsure, use "Other Deductions"
- Consider Australian tax context — e.g. "Officeworks" is likely "Tools & Equipment", "Uber" could be "Vehicle & Travel"
- Do NOT wrap in markdown code fences, return raw JSON only
- The index must match the position in the input array (0-based)`;

function parseCSV(text: string): { date: string; description: string; amount: number }[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Detect header row
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('date') || header.includes('description') || header.includes('amount') || header.includes('narration') || header.includes('debit');

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const results: { date: string; description: string; amount: number }[] = [];

  // Try to detect column positions from header
  let dateCol = 0;
  let descCol = 1;
  let amountCol = 2;

  if (hasHeader) {
    const cols = splitCSVLine(lines[0]).map(c => c.toLowerCase().trim());
    const dateIdx = cols.findIndex(c => c.includes('date'));
    const descIdx = cols.findIndex(c => c.includes('description') || c.includes('narration') || c.includes('memo') || c.includes('details') || c.includes('transaction'));
    const amountIdx = cols.findIndex(c => c.includes('amount') || c.includes('debit') || c.includes('value'));

    if (dateIdx >= 0) dateCol = dateIdx;
    if (descIdx >= 0) descCol = descIdx;
    if (amountIdx >= 0) amountCol = amountIdx;
  }

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = splitCSVLine(line);
    if (cols.length < 3) continue;

    const rawDate = cols[dateCol]?.trim();
    const description = cols[descCol]?.trim();
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
    const financialYear = (formData.get('financialYear') as string) || '2025-2026';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV. Expected columns: Date, Description, Amount' }, { status: 400 });
    }

    // Categorise with Gemini
    const descriptions = parsed.map((p, i) => `${i}. "${p.description}" ($${p.amount.toFixed(2)})`).join('\n');
    const prompt = `Categorise these ${parsed.length} expense transactions:\n${descriptions}`;

    const model = await getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    let categories: { index: number; category: string }[] = [];
    try {
      categories = JSON.parse(cleaned);
    } catch {
      // If Gemini response isn't valid JSON, default all to Other
      categories = parsed.map((_, i) => ({ index: i, category: 'Other Deductions' }));
    }

    // Build category lookup
    const categoryMap = new Map<number, string>();
    for (const cat of categories) {
      const validCategory = CATEGORIES.includes(cat.category) ? cat.category : 'Other Deductions';
      categoryMap.set(cat.index, validCategory);
    }

    // Return preview — don't save yet, let user review
    const preview = parsed.map((p, i) => ({
      date: p.date,
      description: p.description,
      amount: p.amount,
      category: categoryMap.get(i) || 'Other Deductions',
      financialYear,
    }));

    return NextResponse.json({ preview, total: preview.length });
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
      const ref = db.collection('users').doc(userId).collection('expenses').doc();
      const expense: Expense = { id: ref.id, ...data };
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
