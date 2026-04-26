import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getDb } from '../lib/firestore';

const RETENTION_DAYS = 90;
const BATCH_LIMIT = 400;

/**
 * Daily sweep that deletes read notifications older than 90 days. Iterates
 * users via the `users` collection (one doc per email, matches the rest of
 * the app).
 */
export const notificationsCleanup = onSchedule(
  {
    schedule: 'every day 02:00',
    timeZone: 'Australia/Sydney',
    region: 'australia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getDb();
    const cutoffIso = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

    const users = await db.collection('users').listDocuments();
    let totalDeleted = 0;

    for (const userRef of users) {
      // Firestore range comparators exclude null values, so this implicitly
      // skips unread notifications.
      const stale = await userRef
        .collection('notifications')
        .where('readAt', '<', cutoffIso)
        .limit(BATCH_LIMIT)
        .get();
      if (stale.empty) continue;

      const batch = db.batch();
      stale.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += stale.size;
    }

    logger.info('notificationsCleanup deleted', { totalDeleted, cutoffIso });
  },
);
