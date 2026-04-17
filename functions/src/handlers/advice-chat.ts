import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../lib/firestore';
import { requireUserEmail } from '../lib/auth';
import type { ChatMessage } from '../lib/types';

const VALID_TYPES = ['tax', 'investments', 'custom-spending-categories'] as const;
type AdviceChatType = (typeof VALID_TYPES)[number];

interface AdviceChatData {
  action: 'get' | 'put' | 'delete';
  type: AdviceChatType;
  history?: ChatMessage[];
}

export const adviceChat = onCall(
  { region: 'australia-southeast1', serviceAccount: 'finance-doctor-functions' },
  async (request: CallableRequest<AdviceChatData>) => {
    const email = requireUserEmail(request);
    const { action, type, history } = request.data;

    if (!VALID_TYPES.includes(type)) {
      throw new HttpsError('invalid-argument', 'Invalid type.');
    }

    const ref = getDb()
      .collection('users').doc(email)
      .collection('advice-chats').doc(type);

    if (action === 'get') {
      const doc = await ref.get();
      return { history: doc.exists ? (doc.data()?.history ?? []) : [] };
    }

    if (action === 'put') {
      await ref.set({ history: history ?? [], updatedAt: new Date().toISOString() });
      return { ok: true };
    }

    if (action === 'delete') {
      await ref.delete();
      return { ok: true };
    }

    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
);
