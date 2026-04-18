import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';

const TAX_CATEGORIES = [
  'Work from Home', 'Vehicle & Travel', 'Clothing & Laundry', 'Self-Education',
  'Tools & Equipment', 'Professional Memberships', 'Phone & Internet',
  'Donations', 'Investment Expenses', 'Investment Property', 'Other Deductions',
];

const SPENDING_CATEGORIES = [
  'Groceries', 'Dining & Takeaway', 'Transport', 'Utilities & Bills',
  'Shopping', 'Healthcare', 'Entertainment', 'Subscriptions', 'Education',
  'Insurance', 'Home & Garden', 'Personal Care', 'Travel & Holidays',
  'Gifts & Donations', 'Financial & Banking', 'Cafe', 'Bakery', 'Car',
  'Personal Project', 'Kids Entertainment', 'Other',
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

interface FixData {
  action: 'fix';
}

interface CategoriseData {
  action: 'categorise';
  batchSize?: number;
}

type ExpensesMigrateData = FixData | CategoriseData;

export const expensesMigrate = onCall<ExpensesMigrateData>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<ExpensesMigrateData>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const db = getDb();

    if (request.data.action === 'fix') {
      const snap = await db.collection('users').doc(email).collection('expenses').get();

      const batch = db.batch();
      let fixed = 0;
      let addedFY = 0;
      let setOwner = 0;

      for (const doc of snap.docs) {
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

      const needsCategorisation = snap.docs.filter(d => !d.data().spendingCategory).length;

      auditLog({
        endpoint: 'expensesMigrate',
        email,
        durationMs: Date.now() - start,
        action: 'fix',
        geminiCalled: false,
        total: snap.size,
        fixed,
        addedFY,
        setOwner,
        needsCategorisation,
      });
      return { total: snap.size, fixed, addedFY, setOwner, needsCategorisation };
    }

    if (request.data.action === 'categorise') {
      const batchSize = request.data.batchSize ?? 50;

      const rulesSnap = await db.collection('users').doc(email).collection('category-rules').get();
      const rules = rulesSnap.docs.map(d => d.data() as { pattern: string; taxCategory?: string; spendingCategory?: string });

      const findRule = (description: string) => {
        const lower = description.toLowerCase();
        return rules.find(r => lower.includes(r.pattern));
      };

      const snap = await db.collection('users').doc(email).collection('expenses').get();

      const needsCategorisation = snap.docs.filter(d => !d.data().spendingCategory);

      if (needsCategorisation.length === 0) {
        auditLog({
          endpoint: 'expensesMigrate',
          email,
          durationMs: Date.now() - start,
          action: 'categorise',
          geminiCalled: false,
          remaining: 0,
        });
        return { categorised: 0, remaining: 0, ruleApplied: 0 };
      }

      const chunk = needsCategorisation.slice(0, batchSize);

      const ruleBatch = db.batch();
      let ruleApplied = 0;
      const needsAI: { doc: FirebaseFirestore.QueryDocumentSnapshot; idx: number }[] = [];

      chunk.forEach((doc, idx) => {
        const data = doc.data();
        const rule = findRule(data.description || '');
        if (rule && (rule.taxCategory || rule.spendingCategory)) {
          const updates: Record<string, string> = {};
          updates.spendingCategory = rule.spendingCategory || 'Other';
          if (rule.taxCategory && data.category === 'Other Deductions') updates.category = rule.taxCategory;
          ruleBatch.update(doc.ref, updates);
          ruleApplied++;
        } else {
          needsAI.push({ doc, idx });
        }
      });

      if (ruleApplied > 0) await ruleBatch.commit();

      let aiCategorised = 0;
      if (needsAI.length > 0) {
        const descriptions = needsAI.map(({ doc }, i) => {
          const d = doc.data();
          return `${i}. "${d.description}" ($${d.amount?.toFixed(2) || '0.00'})`;
        }).join('\n');

        const model = getGeminiModel();
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `Categorise these ${needsAI.length} expense transactions:\n${descriptions}` }] }],
          systemInstruction: { role: 'system', parts: [{ text: CATEGORISE_PROMPT }] },
        });

        const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const categories: { index: number; category?: string; spendingCategory?: string }[] = JSON.parse(cleaned);

        const aiBatch = db.batch();
        for (const cat of categories) {
          if (cat.index < 0 || cat.index >= needsAI.length) continue;
          const { doc } = needsAI[cat.index];
          const data = doc.data();
          const updates: Record<string, string> = {};

          updates.spendingCategory = (cat.spendingCategory && SPENDING_CATEGORIES.includes(cat.spendingCategory)) ? cat.spendingCategory : 'Other';
          if (data.category === 'Other Deductions' && cat.category && TAX_CATEGORIES.includes(cat.category)) {
            updates.category = cat.category;
          }

          if (Object.keys(updates).length > 0) {
            aiBatch.update(doc.ref, updates);
            aiCategorised++;
          }
        }
        await aiBatch.commit();
      }

      auditLog({
        endpoint: 'expensesMigrate',
        email,
        durationMs: Date.now() - start,
        action: 'categorise',
        geminiCalled: needsAI.length > 0,
        batchSize,
        batchProcessed: chunk.length,
        ruleApplied,
        aiCategorised,
        remaining: needsCategorisation.length - chunk.length,
      });
      return {
        categorised: ruleApplied + aiCategorised,
        ruleApplied,
        aiCategorised,
        remaining: needsCategorisation.length - chunk.length,
        batchProcessed: chunk.length,
      };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
