import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';
import { INVESTMENT_SYSTEM_PROMPT, buildInvestmentPrompt } from '@/lib/prompts';
import type { Investment, FamilyMember } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return new Response('Unauthorized', { status: 401 });

    const { history, followUp } = await req.json().catch(() => ({}));

    const db = getDb();
    const snapshot = await db
      .collection('users').doc(userId)
      .collection('investments')
      .get();

    const investments: Investment[] = snapshot.docs.map(doc => doc.data() as Investment);
    if (investments.length === 0) {
      return new Response('No investments found', { status: 400 });
    }

    const membersSnapshot = await db
      .collection('users').doc(userId)
      .collection('family-members')
      .get();
    const familyMembers: FamilyMember[] = membersSnapshot.docs.map(doc => doc.data() as FamilyMember);

    const model = await getGeminiModel();
    const initialPrompt = buildInvestmentPrompt(investments, familyMembers.length > 0 ? familyMembers : undefined);

    const contents: { role: string; parts: { text: string }[] }[] = [
      { role: 'user', parts: [{ text: initialPrompt }] },
    ];

    if (history && Array.isArray(history)) {
      for (const msg of history as ChatMessage[]) {
        contents.push({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] });
      }
    }

    if (followUp) {
      contents.push({ role: 'user', parts: [{ text: followUp }] });
    }

    const result = await model.generateContentStream({
      contents,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Investment advice error:', message);
    return new Response(message, { status: 500 });
  }
}
