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
Given a list of expense transactions, re-categorise each one into exactly one of these ATO deduction categories:
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rules:
- Return a JSON array of objects: [{"id": "expense-id", "category": "exact category name"}]
- Use ONLY the exact category names listed above
- If unsure, use "Other Deductions"
- Consider Australian tax context — e.g. "Officeworks" is likely "Tools & Equipment", "Uber" could be "Vehicle & Travel"
- Do NOT wrap in markdown code fences, return raw JSON only`;

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { financialYear } = await req.json();
    const db = getDb();

    let query = db.collection('users').doc(userId).collection('expenses') as FirebaseFirestore.Query;
    if (financialYear && financialYear !== 'all') {
      query = query.where('financialYear', '==', financialYear);
    }
    const snapshot = await query.get();

    const expenses: Expense[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    if (expenses.length === 0) {
      return NextResponse.json({ error: 'No expenses to re-analyse' }, { status: 400 });
    }

    const descriptions = expenses.map((e, i) => `${i}. [id:${e.id}] "${e.description}" ($${e.amount.toFixed(2)})`).join('\n');
    const prompt = `Re-categorise these ${expenses.length} expense transactions:\n${descriptions}`;

    const model = await getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    let categories: { id: string; category: string }[] = [];
    try {
      categories = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Update expenses in Firestore
    const batch = db.batch();
    let updated = 0;
    for (const cat of categories) {
      const validCategory = CATEGORIES.includes(cat.category) ? cat.category : null;
      if (!validCategory) continue;
      const ref = db.collection('users').doc(userId).collection('expenses').doc(cat.id);
      batch.update(ref, { category: validCategory });
      updated++;
    }
    await batch.commit();

    return NextResponse.json({ updated, total: expenses.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Re-analyse error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
