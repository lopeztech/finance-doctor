import { HttpsError, onCall, type CallableRequest, type CallableResponse } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { getGeminiModel } from '../lib/gemini';
import { requireUserEmail } from '../lib/auth';
import { INVESTMENT_SYSTEM_PROMPT, buildInvestmentPrompt } from '../lib/prompts';
import type { Investment, FamilyMember, ChatMessage } from '../lib/types';

interface InvestmentsAdviceData {
  history?: ChatMessage[];
  followUp?: string;
}

export const investmentsAdvice = onCall<InvestmentsAdviceData, Promise<{ text: string }>>(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<InvestmentsAdviceData>, response?: CallableResponse<string>) => {
    const email = requireUserEmail(request);
    const { history, followUp } = request.data;
    const db = getDb();

    const snap = await db.collection('users').doc(email).collection('investments').get();
    const investments: Investment[] = snap.docs.map(d => d.data() as Investment);
    if (investments.length === 0) {
      throw new HttpsError('failed-precondition', 'No investments found.');
    }

    const membersSnap = await db.collection('users').doc(email).collection('family-members').get();
    const familyMembers: FamilyMember[] = membersSnap.docs.map(d => d.data() as FamilyMember);

    const initialPrompt = buildInvestmentPrompt(investments, familyMembers.length > 0 ? familyMembers : undefined);

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
      systemInstruction: { role: 'system', parts: [{ text: INVESTMENT_SYSTEM_PROMPT }] },
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
    return { text: full };
  }
);
