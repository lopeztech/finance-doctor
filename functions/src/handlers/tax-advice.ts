import { HttpsError, onCall, type CallableRequest, type CallableResponse } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import { TAX_SYSTEM_PROMPT, buildTaxPrompt } from '../lib/prompts';
import type { Expense, FamilyMember, ChatMessage } from '../lib/types';

interface TaxAdviceData {
  financialYear?: string;
  history?: ChatMessage[];
  followUp?: string;
}

export const taxAdvice = onCall<TaxAdviceData, Promise<{ text: string }>>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<TaxAdviceData>, response?: CallableResponse<string>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const { financialYear, history, followUp } = request.data;
    const db = getDb();

    const snap = financialYear && financialYear !== 'all'
      ? await db.collection('users').doc(email).collection('expenses').where('financialYear', '==', financialYear).get()
      : await db.collection('users').doc(email).collection('expenses').get();

    const expenses: Expense[] = snap.docs.map(d => d.data() as Expense);
    if (expenses.length === 0) {
      throw new HttpsError('failed-precondition', 'No expenses found for this financial year.');
    }

    const membersSnap = await db.collection('users').doc(email).collection('family-members').get();
    const familyMembers: FamilyMember[] = membersSnap.docs.map(d => d.data() as FamilyMember);

    const initialPrompt = buildTaxPrompt(expenses, financialYear || '2025-2026', familyMembers.length > 0 ? familyMembers : undefined);

    const contents: { role: string; parts: { text: string }[] }[] = [
      { role: 'user', parts: [{ text: initialPrompt }] },
    ];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] });
      }
    }
    if (followUp) {
      contents.push({ role: 'user', parts: [{ text: followUp }] });
    }

    const model = getGeminiModel();
    const result = await model.generateContentStream({
      contents,
      systemInstruction: { role: 'system', parts: [{ text: TAX_SYSTEM_PROMPT }] },
    });

    let full = '';
    for await (const chunk of result.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) continue;
      full += text;
      if (request.acceptsStreaming && response) {
        await response.sendChunk(text);
      }
    }
    auditLog({
      endpoint: 'taxAdvice',
      email,
      durationMs: Date.now() - start,
      geminiCalled: true,
      financialYear: financialYear ?? 'all',
      expenseCount: expenses.length,
      followUp: Boolean(followUp),
      responseChars: full.length,
      streamed: Boolean(request.acceptsStreaming),
    });
    return { text: full };
  }
);
