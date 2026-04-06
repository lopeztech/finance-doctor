import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';
import { TAX_SYSTEM_PROMPT, buildTaxPrompt } from '@/lib/prompts';
import type { Expense } from '@/lib/types';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { financialYear } = await req.json();
  const db = getDb();
  const snapshot = await db
    .collection('users').doc(userId)
    .collection('expenses')
    .where('financialYear', '==', financialYear || '2025-2026')
    .get();

  const expenses: Expense[] = snapshot.docs.map(doc => doc.data() as Expense);
  if (expenses.length === 0) {
    return new Response('No expenses found for this financial year', { status: 400 });
  }

  const model = getGeminiModel();
  const prompt = buildTaxPrompt(expenses, financialYear || '2025-2026');

  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { role: 'system', parts: [{ text: TAX_SYSTEM_PROMPT }] },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  });
}
