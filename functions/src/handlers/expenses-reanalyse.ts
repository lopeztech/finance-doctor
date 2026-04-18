import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import type { Expense } from '../lib/types';

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

const SUB_CATEGORY_PROMPT = `You are a personal finance sub-categorisation engine.
For each expense description, propose a SHORT sub-category label — usually the vendor or brand — that groups similar transactions together.

Rules:
- Return a JSON array of objects: [{"description": "EXACT original description", "subCategory": "short label"}]
- "description" MUST match the input description character-for-character so it can be matched back
- "subCategory" should be 1–3 words, Title Case, under 30 characters
- Extract the vendor or brand where possible (e.g. "Coles", "Woolworths", "Uber Eats", "Netflix", "Opal", "Shell")
- If several inputs share a vendor, give them the SAME subCategory so they group together
- If the description has no clear vendor, use a concise functional label (e.g. "ATM Withdrawal", "Bank Fee")
- Consider the spendingCategory hint given for each input
- Do NOT wrap in markdown code fences, return raw JSON only`;

interface ExpensesReanalyseData {
  financialYear?: string;
  type?: 'tax' | 'spending' | 'sub-category';
}

export const expensesReanalyse = onCall<ExpensesReanalyseData>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<ExpensesReanalyseData>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const { financialYear, type } = request.data;
    const isSpending = type === 'spending';
    const isSubCategory = type === 'sub-category';
    const db = getDb();

    const snap = financialYear && financialYear !== 'all'
      ? await db.collection('users').doc(email).collection('expenses').where('financialYear', '==', financialYear).get()
      : await db.collection('users').doc(email).collection('expenses').get();

    const expenses: Expense[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
    if (expenses.length === 0) {
      throw new HttpsError('failed-precondition', 'No expenses to re-analyse.');
    }

    if (isSubCategory) {
      const missing = expenses.filter(e => !(e.spendingSubCategory && e.spendingSubCategory.trim()));
      if (missing.length === 0) {
        auditLog({
          endpoint: 'expensesReanalyse',
          email,
          durationMs: Date.now() - start,
          geminiCalled: false,
          type: 'sub-category',
          financialYear: financialYear ?? 'all',
          expenseCount: expenses.length,
          updatedCount: 0,
        });
        return { updated: 0, total: expenses.length };
      }

      const groups = new Map<string, { description: string; spendingCategory: string; count: number }>();
      for (const e of missing) {
        const desc = (e.description || '').trim();
        if (!desc) continue;
        const cat = e.spendingCategory || 'Other';
        const existing = groups.get(desc);
        if (existing) existing.count += 1;
        else groups.set(desc, { description: desc, spendingCategory: cat, count: 1 });
      }

      if (groups.size === 0) {
        return { updated: 0, total: expenses.length };
      }

      const entries = [...groups.values()];
      const prompt = `Propose a short sub-category for each of these ${entries.length} unique descriptions:\n`
        + entries.map((g, i) => `${i + 1}. "${g.description}" [${g.spendingCategory}] × ${g.count}`).join('\n');

      const model = getGeminiModel();
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: SUB_CATEGORY_PROMPT }] },
      });

      const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

      let parsed: { description?: string; subCategory?: string }[] = [];
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new HttpsError('internal', 'Failed to parse AI response.');
      }

      const mapping = new Map<string, string>();
      for (const item of parsed) {
        const desc = (item.description || '').trim();
        const sub = (item.subCategory || '').trim();
        if (!desc || !sub) continue;
        const clipped = sub.length > 40 ? sub.slice(0, 40) : sub;
        mapping.set(desc, clipped);
      }

      const descToIds = new Map<string, string[]>();
      for (const e of missing) {
        const desc = (e.description || '').trim();
        if (!descToIds.has(desc)) descToIds.set(desc, []);
        descToIds.get(desc)!.push(e.id);
      }

      const expenseCol = db.collection('users').doc(email).collection('expenses');
      const expenseBatch = db.batch();
      let updated = 0;
      for (const [desc, sub] of mapping) {
        const ids = descToIds.get(desc) || [];
        for (const id of ids) {
          expenseBatch.update(expenseCol.doc(id), { spendingSubCategory: sub });
          updated++;
        }
      }
      if (updated > 0) await expenseBatch.commit();

      if (mapping.size > 0) {
        const ruleCol = db.collection('users').doc(email).collection('category-rules');
        for (const [desc, sub] of mapping) {
          const pattern = desc.toLowerCase();
          const existingRules = await ruleCol.where('pattern', '==', pattern).limit(1).get();
          if (existingRules.empty) {
            const ref = ruleCol.doc();
            await ref.set({ id: ref.id, pattern, spendingSubCategory: sub });
          } else {
            await existingRules.docs[0].ref.update({ spendingSubCategory: sub });
          }
        }
      }

      auditLog({
        endpoint: 'expensesReanalyse',
        email,
        durationMs: Date.now() - start,
        geminiCalled: true,
        type: 'sub-category',
        financialYear: financialYear ?? 'all',
        expenseCount: expenses.length,
        missingCount: missing.length,
        groupCount: groups.size,
        updatedCount: updated,
      });
      return { updated, total: missing.length };
    }

    const descriptions = expenses.map((e, i) => `${i}. [id:${e.id}] "${e.description}" ($${e.amount.toFixed(2)})`).join('\n');
    const prompt = `Re-categorise these ${expenses.length} expense transactions:\n${descriptions}`;

    const model = getGeminiModel();
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
      throw new HttpsError('internal', 'Failed to parse AI response.');
    }

    const batch = db.batch();
    let updated = 0;
    for (const item of results) {
      const ref = db.collection('users').doc(email).collection('expenses').doc(item.id);
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

    auditLog({
      endpoint: 'expensesReanalyse',
      email,
      durationMs: Date.now() - start,
      geminiCalled: true,
      type: isSpending ? 'spending' : 'tax',
      financialYear: financialYear ?? 'all',
      expenseCount: expenses.length,
      updatedCount: updated,
    });
    return { updated, total: expenses.length };
  }
);
