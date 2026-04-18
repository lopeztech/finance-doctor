import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { requireUserEmail } from '../lib/auth';
import { auditLog } from '../lib/audit';
import type { ChatMessage } from '../lib/types';

const VALID_TYPES = ['tax', 'investments', 'custom-spending-categories'] as const;
type AdviceChatType = (typeof VALID_TYPES)[number];

interface AdviceChatData {
  action: 'get' | 'put' | 'delete';
  type: AdviceChatType;
  history?: ChatMessage[];
}

export const adviceChat = onCall(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions@' },
  async (request: CallableRequest<AdviceChatData>) => {
    const start = Date.now();
    const email = requireUserEmail(request);
    const { action, type, history } = request.data;

    if (!VALID_TYPES.includes(type)) {
      throw new HttpsError('invalid-argument', 'Invalid type.');
    }

    const ref = getDb()
      .collection('users').doc(email)
      .collection('advice-chats').doc(type);

    let result: { history?: unknown[]; ok?: boolean };
    let historyLength = 0;

    if (action === 'get') {
      const doc = await ref.get();
      const stored = doc.exists ? (doc.data()?.history ?? []) : [];
      historyLength = Array.isArray(stored) ? stored.length : 0;
      result = { history: stored };
    } else if (action === 'put') {
      historyLength = Array.isArray(history) ? history.length : 0;
      await ref.set({ history: history ?? [], updatedAt: new Date().toISOString() });
      result = { ok: true };
    } else if (action === 'delete') {
      await ref.delete();
      result = { ok: true };
    } else {
      throw new HttpsError('invalid-argument', 'Invalid action.');
    }

    auditLog({ endpoint: 'adviceChat', email, durationMs: Date.now() - start, action, type, historyLength });
    return result;
  }
);
