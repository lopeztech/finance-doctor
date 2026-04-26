import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getDb } from '../lib/firestore';

interface InvestmentDoc {
  currentValue?: number;
}

interface GoalDoc {
  id: string;
  name?: string;
  targetAmount?: number;
  linkedInvestments?: string[];
  archivedAt?: string;
  lastAlertedMilestone?: number;
}

interface NotificationPreferences {
  perKind?: Record<string, 'in-app' | 'email' | 'both' | 'off'>;
}

const MILESTONES = [0.25, 0.5, 0.75, 1.0];

function balanceFor(goal: GoalDoc, investments: Map<string, InvestmentDoc>): number {
  if (!goal.linkedInvestments?.length) return 0;
  let sum = 0;
  for (const id of goal.linkedInvestments) {
    const inv = investments.get(id);
    const v = inv?.currentValue;
    if (typeof v === 'number' && Number.isFinite(v)) sum += v;
  }
  return sum;
}

function nextMilestone(goal: GoalDoc, fraction: number): number | null {
  const ceiling = goal.lastAlertedMilestone ?? -Infinity;
  let next: number | null = null;
  for (const m of MILESTONES) {
    if (fraction >= m && m > ceiling) next = m;
  }
  return next;
}

/**
 * Daily sweep that fires goal-milestone notifications when a goal newly
 * crosses 25 / 50 / 75 / 100 % of target. Idempotent — milestones only fire
 * once per goal lifetime via lastAlertedMilestone, mirroring the budgets
 * pattern. Honours per-kind notification preferences.
 */
export const goalsMilestones = onSchedule(
  {
    schedule: 'every day 04:00',
    timeZone: 'Australia/Sydney',
    region: 'australia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getDb();
    let alertsWritten = 0;

    const users = await db.collection('users').listDocuments();
    for (const userRef of users) {
      const goalsSnap = await userRef.collection('goals').get();
      if (goalsSnap.empty) continue;

      const prefsSnap = await userRef.collection('meta').doc('notification-preferences').get();
      const prefs = (prefsSnap.exists ? prefsSnap.data() : {}) as NotificationPreferences;
      const channel = prefs.perKind?.['goal-milestone'] ?? 'in-app';
      if (channel === 'off') continue;
      const inApp = channel === 'in-app' || channel === 'both';
      if (!inApp) continue;

      const invSnap = await userRef.collection('investments').get();
      const investments = new Map<string, InvestmentDoc>();
      for (const d of invSnap.docs) investments.set(d.id, d.data() as InvestmentDoc);

      for (const goalDoc of goalsSnap.docs) {
        const goal = { id: goalDoc.id, ...(goalDoc.data() as Omit<GoalDoc, 'id'>) };
        if (goal.archivedAt) continue;
        const target = goal.targetAmount ?? 0;
        if (target <= 0) continue;
        const balance = balanceFor(goal, investments);
        const fraction = Math.min(1, balance / target);
        const milestone = nextMilestone(goal, fraction);
        if (milestone === null) continue;

        const dedupeId = `goal-${goal.id}-${Math.round(milestone * 100)}`;
        const notifRef = userRef.collection('notifications').doc(dedupeId);
        const pct = Math.round(milestone * 100);
        const title = pct === 100
          ? `${goal.name || 'Goal'} reached 🎯`
          : `${goal.name || 'Goal'} at ${pct}%`;
        const body = `Saved $${balance.toFixed(2)} of $${target.toFixed(2)}.`;

        const batch = db.batch();
        batch.set(notifRef, {
          id: dedupeId,
          kind: 'goal-milestone',
          title,
          body,
          link: '/goals',
          createdAt: new Date().toISOString(),
          readAt: null,
        }, { merge: true });
        batch.update(goalDoc.ref, { lastAlertedMilestone: milestone });
        await batch.commit();
        alertsWritten += 1;
      }
    }

    logger.info('goalsMilestones swept', { alertsWritten });
  },
);
