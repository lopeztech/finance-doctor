import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getDb } from '../lib/firestore';

interface Budget {
  id: string;
  scope: 'overall' | 'spending-category' | 'spending-sub-category';
  category?: string;
  subCategory?: string;
  amount: number;
  startMonth: string;
  rolloverUnused: boolean;
  alertThresholds: number[];
  lastAlertedMonth?: string;
  lastAlertedThreshold?: number;
}

interface ExpenseDoc {
  date?: string;
  amount?: number;
  spendingCategory?: string;
  spendingSubCategory?: string;
}

interface NotificationPreferences {
  perKind?: Record<string, 'in-app' | 'email' | 'both' | 'off'>;
}

const DEFAULT_THRESHOLDS = [0.8, 1.0, 1.2];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function matches(budget: Budget, e: ExpenseDoc): boolean {
  if (budget.scope === 'overall') return true;
  if (budget.scope === 'spending-category') return e.spendingCategory === budget.category;
  return e.spendingCategory === budget.category && e.spendingSubCategory === budget.subCategory;
}

function spendForMonth(budget: Budget, expenses: ExpenseDoc[], month: string): number {
  let total = 0;
  for (const e of expenses) {
    if (!e?.date || typeof e.amount !== 'number') continue;
    if (e.date.slice(0, 7) !== month) continue;
    if (!matches(budget, e)) continue;
    total += e.amount;
  }
  return total;
}

function rolloverInForMonth(budget: Budget, expenses: ExpenseDoc[], month: string): number {
  if (!budget.rolloverUnused) return 0;
  if (month <= budget.startMonth) return 0;
  const prev = previousMonth(month);
  const prevSpend = spendForMonth(budget, expenses, prev);
  const surplus = budget.amount - prevSpend;
  if (surplus <= 0) return 0;
  return Math.min(surplus, budget.amount);
}

function nextThresholdToAlert(budget: Budget, ratio: number, month: string): number | null {
  const thresholds = budget.alertThresholds?.length
    ? [...budget.alertThresholds].sort((a, b) => a - b)
    : [...DEFAULT_THRESHOLDS];
  const sameMonth = budget.lastAlertedMonth === month;
  const ceiling = sameMonth ? (budget.lastAlertedThreshold ?? -Infinity) : -Infinity;
  let next: number | null = null;
  for (const t of thresholds) {
    if (ratio >= t && t > ceiling) next = t;
  }
  return next;
}

function describeBudget(b: Budget): string {
  if (b.scope === 'overall') return 'Overall monthly spending';
  if (b.scope === 'spending-sub-category') return `${b.category} → ${b.subCategory}`;
  return b.category ?? 'Uncategorised';
}

/**
 * Hourly cron: for each user, computes month-to-date spend per budget and
 * writes a `budget-alert` notification when a new threshold is crossed. The
 * budget doc carries `lastAlertedMonth` + `lastAlertedThreshold` so each
 * threshold fires at most once per month per budget.
 */
export const budgetsAlerts = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Australia/Sydney',
    region: 'australia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getDb();
    const month = monthKey(new Date());
    let alertsWritten = 0;

    const users = await db.collection('users').listDocuments();
    for (const userRef of users) {
      const budgetsSnap = await userRef.collection('budgets').get();
      if (budgetsSnap.empty) continue;

      const expensesSnap = await userRef
        .collection('expenses')
        .where('date', '>=', `${previousMonth(month)}-01`)
        .get();
      const expenses = expensesSnap.docs.map(d => d.data() as ExpenseDoc);

      // Pull notification preferences once per user; default to in-app on.
      const prefsSnap = await userRef.collection('meta').doc('notification-preferences').get();
      const prefs = (prefsSnap.exists ? prefsSnap.data() : {}) as NotificationPreferences;
      const channel = prefs.perKind?.['budget-alert'] ?? 'in-app';
      if (channel === 'off') continue;
      const inApp = channel === 'in-app' || channel === 'both';
      if (!inApp) continue;

      for (const budgetDoc of budgetsSnap.docs) {
        const budget = { id: budgetDoc.id, ...(budgetDoc.data() as Omit<Budget, 'id'>) };
        const spent = spendForMonth(budget, expenses, month);
        const rolloverIn = rolloverInForMonth(budget, expenses, month);
        const effectiveCap = Math.max(0.01, budget.amount + rolloverIn);
        const ratio = spent / effectiveCap;
        const threshold = nextThresholdToAlert(budget, ratio, month);
        if (threshold === null) continue;

        const dedupeId = `budget-${budget.id}-${month}-${Math.round(threshold * 100)}`;
        const notifRef = userRef.collection('notifications').doc(dedupeId);
        const pct = Math.round(threshold * 100);
        const title = pct >= 100
          ? `${describeBudget(budget)} budget exceeded (${pct}%)`
          : `${describeBudget(budget)} budget at ${pct}%`;
        const body = `Spent $${spent.toFixed(2)} of $${effectiveCap.toFixed(2)} for ${month}.`;

        const batch = db.batch();
        batch.set(notifRef, {
          id: dedupeId,
          kind: 'budget-alert',
          title,
          body,
          link: '/budgets',
          createdAt: new Date().toISOString(),
          readAt: null,
        }, { merge: true });
        batch.update(budgetDoc.ref, {
          lastAlertedMonth: month,
          lastAlertedThreshold: threshold,
        });
        await batch.commit();
        alertsWritten += 1;
      }
    }

    logger.info('budgetsAlerts swept', { alertsWritten, month });
  },
);
