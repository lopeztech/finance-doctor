import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';
import type { Expense } from '@/lib/types';

const TAX_CATEGORIES = [
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

const TAX_PROMPT = `You are an Australian tax categorisation engine.
Given a list of expense transactions, re-categorise each one into exactly one of these ATO deduction categories:
${TAX_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rules:
- Return a JSON array of objects: [{"id": "expense-id", "category": "exact category name"}]
- Use ONLY the exact category names listed above
- If unsure, use "Other Deductions"
- Consider Australian tax context
- Do NOT wrap in markdown code fences, return raw JSON only`;

const SPENDING_PROMPT = `You are a personal finance categorisation engine.
Given a list of expense transactions, categorise each one into exactly one of these spending categories:
${SPENDING_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rules:
- Return a JSON array of objects: [{"id": "expense-id", "spendingCategory": "exact category name"}]
- Use ONLY the exact category names listed above
- If unsure, use "Other"
- Consider Australian context — e.g. "Coles" is "Groceries", "Uber" is "Transport", "Netflix" is "Subscriptions"
- Do NOT wrap in markdown code fences, return raw JSON only`;

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { financialYear, type } = await req.json();
    const isSpending = type === 'spending';
    const db = getDb();

    let snapshot;
    if (financialYear && financialYear !== 'all') {
      snapshot = await db.collection('users').doc(userId).collection('expenses')
        .where('financialYear', '==', financialYear).get();
    } else {
      snapshot = await db.collection('users').doc(userId).collection('expenses').get();
    }

    const expenses: Expense[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    if (expenses.length === 0) {
      return NextResponse.json({ error: 'No expenses to re-analyse' }, { status: 400 });
    }

    const descriptions = expenses.map((e, i) => `${i}. [id:${e.id}] "${e.description}" ($${e.amount.toFixed(2)})`).join('\n');
    const prompt = `Re-categorise these ${expenses.length} expense transactions:\n${descriptions}`;

    const model = await getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: isSpending ? SPENDING_PROMPT : TAX_PROMPT }] },
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    let results: { id: string; category?: string; spendingCategory?: string }[] = [];
    try {
      results = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const batch = db.batch();
    let updated = 0;
    for (const item of results) {
      const ref = db.collection('users').doc(userId).collection('expenses').doc(item.id);
      if (isSpending) {
        const valid = SPENDING_CATEGORIES.includes(item.spendingCategory || '') ? item.spendingCategory : null;
        if (!valid) continue;
        batch.update(ref, { spendingCategory: valid });
      } else {
        const valid = TAX_CATEGORIES.includes(item.category || '') ? item.category : null;
        if (!valid) continue;
        batch.update(ref, { category: valid });
      }
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
