import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';

const TAX_CATEGORIES = [
  'Work from Home', 'Vehicle & Travel', 'Clothing & Laundry', 'Self-Education',
  'Tools & Equipment', 'Professional Memberships', 'Phone & Internet',
  'Donations', 'Investment Expenses', 'Other Deductions',
];

const SPENDING_CATEGORIES = [
  'Groceries', 'Dining & Takeaway', 'Transport', 'Utilities & Bills',
  'Shopping', 'Healthcare', 'Entertainment', 'Subscriptions', 'Education',
  'Insurance', 'Home & Garden', 'Personal Care', 'Travel & Holidays',
  'Gifts & Donations', 'Financial & Banking', 'Other',
];

const CATEGORISE_PROMPT = `You are a financial categorisation engine.
Given a list of expense transactions, categorise each one into:
1. A TAX deduction category (for ATO tax purposes)
2. A SPENDING category (for personal budgeting)

TAX categories: ${TAX_CATEGORIES.join(', ')}
SPENDING categories: ${SPENDING_CATEGORIES.join(', ')}

Rules:
- Return a JSON array: [{"index": 0, "category": "tax category", "spendingCategory": "spending category"}]
- Use ONLY the exact category names listed above
- If unsure about tax, use "Other Deductions". If unsure about spending, use "Other"
- Do NOT wrap in markdown code fences, return raw JSON only`;

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

// POST — Quick fixes (FY, owner, cleanup). No AI.
export async function POST() {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const snapshot = await db.collection('users').doc(userId).collection('expenses').get();

    const batch = db.batch();
    let fixed = 0;
    let addedFY = 0;
    let setOwner = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const updates: Record<string, unknown> = {};

      if (!data.financialYear && data.date) {
        updates.financialYear = getFinancialYear(data.date);
        addedFY++;
      }

      if (!data.owner || data.owner === '') {
        updates.owner = 'Josh';
        setOwner++;
      }

      if ('duplicate' in data) {
        updates.duplicate = null;
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        fixed++;
      }
    }

    if (fixed > 0) await batch.commit();

    // Count how many still need categorisation
    const needsCategorisation = snapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.spendingCategory || data.category === 'Other Deductions';
    }).length;

    return NextResponse.json({ total: snapshot.size, fixed, addedFY, setOwner, needsCategorisation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Migration error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — AI categorisation, processes one batch at a time. Call repeatedly.
export async function PUT(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { batchSize = 50 } = await req.json().catch(() => ({}));
    const db = getDb();
    const snapshot = await db.collection('users').doc(userId).collection('expenses').get();

    const needsCategorisation = snapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.spendingCategory || data.category === 'Other Deductions';
    });

    if (needsCategorisation.length === 0) {
      return NextResponse.json({ categorised: 0, remaining: 0 });
    }

    const chunk = needsCategorisation.slice(0, batchSize);
    const descriptions = chunk.map((doc, idx) => {
      const d = doc.data();
      return `${idx}. "${d.description}" ($${d.amount?.toFixed(2) || '0.00'})`;
    }).join('\n');

    const model = await getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Categorise these ${chunk.length} expense transactions:\n${descriptions}` }] }],
      systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const categories: { index: number; category?: string; spendingCategory?: string }[] = JSON.parse(cleaned);

    const batch = db.batch();
    let categorised = 0;
    for (const cat of categories) {
      if (cat.index < 0 || cat.index >= chunk.length) continue;
      const doc = chunk[cat.index];
      const data = doc.data();
      const updates: Record<string, string> = {};

      if (cat.spendingCategory && SPENDING_CATEGORIES.includes(cat.spendingCategory)) {
        updates.spendingCategory = cat.spendingCategory;
      }

      if (data.category === 'Other Deductions' && cat.category && TAX_CATEGORIES.includes(cat.category)) {
        updates.category = cat.category;
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        categorised++;
      }
    }
    await batch.commit();

    return NextResponse.json({
      categorised,
      remaining: needsCategorisation.length - chunk.length,
      batchProcessed: chunk.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Categorisation error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
