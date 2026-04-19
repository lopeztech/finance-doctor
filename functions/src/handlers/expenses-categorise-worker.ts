import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { logger } from 'firebase-functions/v2';
import { getDb } from '../lib/firestore';
import { categoriseBatch } from '../lib/categorise';

export interface CategoriseMessage {
  email: string;
  expenseId: string;
  description: string;
  amount: number;
}

export const EXPENSE_CATEGORISE_TOPIC = 'expense-categorise';

export const expensesCategoriseWorker = onMessagePublished(
  {
    topic: EXPENSE_CATEGORISE_TOPIC,
    region: 'australia-southeast1',
    serviceAccount: 'finance-doctor-functions@',
    retry: true,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const payload = event.data.message.json as CategoriseMessage | undefined;
    if (!payload || !payload.email || !payload.expenseId) {
      logger.error('Invalid categorise message — missing email/expenseId', { payload });
      return;
    }

    const { email, expenseId, description, amount } = payload;
    const db = getDb();
    const ref = db.collection('users').doc(email).collection('expenses').doc(expenseId);

    try {
      const [result] = await categoriseBatch([{ description, amount }]);
      await ref.update({
        category: result.category,
        spendingCategory: result.spendingCategory,
        categorisationStatus: 'done',
      });
      logger.info('Categorised expense', { email, expenseId, category: result.category });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to categorise expense', { email, expenseId, error: message });
      await ref.update({
        categorisationStatus: 'failed',
        categorisationError: message,
      }).catch(() => {});
      throw err;
    }
  }
);
