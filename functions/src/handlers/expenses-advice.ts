import { HttpsError, onCall, type CallableRequest, type CallableResponse } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import { EXPENSES_SYSTEM_PROMPT, buildExpensesPrompt } from '../lib/prompts';
import type { Expense, ChatMessage } from '../lib/types';

interface ExpensesAdviceData {
  history?: ChatMessage[];
  followUp?: string;
}

export const expensesAdvice = onCall<ExpensesAdviceData, Promise<{ text: string }>>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<ExpensesAdviceData>, response?: CallableResponse<string>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const { history, followUp } = request.data;
    const db = getDb();

    const [expensesSnap, settingsSnap] = await Promise.all([
      db.collection('users').doc(email).collection('expenses').get(),
      db.collection('users').doc(email).collection('meta').doc('category-settings').get(),
    ]);
    const allExpenses: Expense[] = expensesSnap.docs.map(d => d.data() as Expense);
    const settings = settingsSnap.exists ? (settingsSnap.data() as { types?: Record<string, string>; excluded?: string[] }) : {};
    const excluded = new Set(settings.excluded || []);
    const expenses = allExpenses.filter(e => !excluded.has(e.spendingCategory || 'Other'));
    if (expenses.length === 0) {
      throw new HttpsError('failed-precondition', 'No expenses found to analyse.');
    }

    const initialPrompt = buildExpensesPrompt(expenses, (settings.types || {}) as Record<string, 'essential' | 'committed' | 'discretionary'>);

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
      systemInstruction: { role: 'system', parts: [{ text: EXPENSES_SYSTEM_PROMPT }] },
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
      endpoint: 'expensesAdvice',
      email,
      durationMs: Date.now() - start,
      geminiCalled: true,
      expenseCount: expenses.length,
      excludedCount: allExpenses.length - expenses.length,
      followUp: Boolean(followUp),
      responseChars: full.length,
      streamed: Boolean(request.acceptsStreaming),
    });
    return { text: full };
  }
);
