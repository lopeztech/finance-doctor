import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';
import { INVESTMENT_SYSTEM_PROMPT, buildInvestmentPrompt } from '@/lib/prompts';
import type { Investment } from '@/lib/types';

export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const db = getDb();
  const snapshot = await db
    .collection('users').doc(userId)
    .collection('investments')
    .get();

  const investments: Investment[] = snapshot.docs.map(doc => doc.data() as Investment);
  if (investments.length === 0) {
    return new Response('No investments found', { status: 400 });
  }

  const model = getGeminiModel();
  const prompt = buildInvestmentPrompt(investments);

  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { role: 'system', parts: [{ text: INVESTMENT_SYSTEM_PROMPT }] },
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
