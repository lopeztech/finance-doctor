import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getDb } from '../lib/firestore';

type DigestFrequency = 'off' | 'weekly' | 'monthly' | 'quarterly';

interface NotificationPreferences {
  digestFrequency?: DigestFrequency;
}

interface BudgetDoc {
  scope: 'overall' | 'spending-category' | 'spending-sub-category';
  category?: string;
  subCategory?: string;
  amount: number;
  startMonth?: string;
  rolloverUnused?: boolean;
}

interface GoalDoc {
  name?: string;
  targetAmount?: number;
  linkedInvestments?: string[];
  archivedAt?: string;
}

interface ExpenseDoc {
  date?: string;
  amount?: number;
  spendingCategory?: string;
  spendingSubCategory?: string;
}

interface InvestmentDoc {
  type?: string;
  currentValue?: number;
}

interface LiabilityDoc {
  currentBalance?: number;
}

const QUARTERLY_MONTHS = new Set([1, 4, 7, 10]);

/**
 * Returns which (if any) digest frequency should fire today for `now`.
 * - weekly  → Monday
 * - monthly → 1st
 * - quarterly → 1st of Jan / Apr / Jul / Oct
 */
export function digestFrequenciesDueOn(now: Date): Set<DigestFrequency> {
  const day = now.getDay(); // 0=Sun, 1=Mon
  const date = now.getDate();
  const month = now.getMonth() + 1;
  const due = new Set<DigestFrequency>();
  if (day === 1) due.add('weekly');
  if (date === 1) due.add('monthly');
  if (date === 1 && QUARTERLY_MONTHS.has(month)) due.add('quarterly');
  return due;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfPeriod(period: DigestFrequency, now: Date): Date {
  const d = new Date(now);
  if (period === 'weekly') d.setDate(d.getDate() - 7);
  else if (period === 'monthly') d.setMonth(d.getMonth() - 1);
  else if (period === 'quarterly') d.setMonth(d.getMonth() - 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface DigestPayload {
  period: DigestFrequency;
  asOf: string;
  totalSpend: number;
  topCategories: { category: string; total: number }[];
  budgetCount: number;
  goalCount: number;
  netWorth: number;
  highlight: string;
}

function buildPayload(
  period: DigestFrequency,
  now: Date,
  expenses: ExpenseDoc[],
  budgets: BudgetDoc[],
  goals: GoalDoc[],
  investments: InvestmentDoc[],
  liabilities: LiabilityDoc[],
): DigestPayload {
  const start = startOfPeriod(period, now);
  let totalSpend = 0;
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    if (!e?.date || typeof e.amount !== 'number') continue;
    const d = new Date(`${e.date}T00:00:00`);
    if (d < start || d > now) continue;
    totalSpend += e.amount;
    const key = e.spendingCategory || 'Other';
    byCategory[key] = (byCategory[key] || 0) + e.amount;
  }
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a).slice(0, 3)
    .map(([category, total]) => ({ category, total }));

  const totalAssets = investments.reduce(
    (sum, i) => sum + (typeof i.currentValue === 'number' && Number.isFinite(i.currentValue) ? i.currentValue : 0),
    0,
  );
  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + (typeof l.currentBalance === 'number' && Number.isFinite(l.currentBalance) ? l.currentBalance : 0),
    0,
  );
  const netWorth = totalAssets - totalLiabilities;

  // Budget breach detection (current calendar month only).
  const month = monthKey(now);
  let breaches = 0;
  let worstName: string | null = null;
  let worstRatio = 0;
  for (const b of budgets) {
    let spent = 0;
    for (const e of expenses) {
      if (!e?.date || typeof e.amount !== 'number') continue;
      if (e.date.slice(0, 7) !== month) continue;
      if (b.scope === 'spending-category' && e.spendingCategory !== b.category) continue;
      if (b.scope === 'spending-sub-category' &&
        (e.spendingCategory !== b.category || e.spendingSubCategory !== b.subCategory)) continue;
      spent += e.amount;
    }
    const ratio = b.amount > 0 ? spent / b.amount : 0;
    if (ratio >= 1) breaches += 1;
    if (ratio > worstRatio) {
      worstRatio = ratio;
      worstName = b.scope === 'overall' ? 'Overall' : (b.category || 'Uncategorised');
    }
  }

  const activeGoals = goals.filter(g => !g.archivedAt);

  let highlight: string;
  if (breaches > 0 && worstName !== null) {
    highlight = `${worstName} budget at ${Math.round(worstRatio * 100)}% — review before month end.`;
  } else if (activeGoals.length > 0) {
    highlight = `${activeGoals.length} active goal${activeGoals.length === 1 ? '' : 's'} — keep contributing on schedule.`;
  } else if (netWorth > 0) {
    highlight = `Net worth $${netWorth.toFixed(0)} — steady this period.`;
  } else {
    highlight = 'Steady period — no breaches, no surprises.';
  }

  return {
    period,
    asOf: isoDate(now),
    totalSpend,
    topCategories,
    budgetCount: budgets.length,
    goalCount: activeGoals.length,
    netWorth,
    highlight,
  };
}

/**
 * Daily 06:00 cron that decides which digest frequencies fire today, then for
 * each user with a matching `notificationPreferences.digestFrequency` it
 * computes a digest payload and writes it to
 * `users/{email}/digests/{period}-{asOf}`. Sending the actual email is the
 * follow-up — for now this gives the user (and us) an audit trail of what
 * would have been sent.
 */
export const digestCron = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'Australia/Sydney',
    region: 'australia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getDb();
    const now = new Date();
    const due = digestFrequenciesDueOn(now);
    if (due.size === 0) {
      logger.info('digestCron: no digest due today', { weekday: now.getDay(), date: now.getDate() });
      return;
    }

    let written = 0;
    const users = await db.collection('users').listDocuments();
    for (const userRef of users) {
      const prefsSnap = await userRef.collection('meta').doc('notification-preferences').get();
      const prefs = (prefsSnap.exists ? prefsSnap.data() : {}) as NotificationPreferences;
      const userFreq = prefs.digestFrequency ?? 'monthly';
      if (userFreq === 'off') continue;
      if (!due.has(userFreq)) continue;

      const [expensesSnap, budgetsSnap, goalsSnap, invSnap, liabSnap] = await Promise.all([
        userRef.collection('expenses').get(),
        userRef.collection('budgets').get(),
        userRef.collection('goals').get(),
        userRef.collection('investments').get(),
        userRef.collection('liabilities').get(),
      ]);

      const payload = buildPayload(
        userFreq,
        now,
        expensesSnap.docs.map(d => d.data() as ExpenseDoc),
        budgetsSnap.docs.map(d => d.data() as BudgetDoc),
        goalsSnap.docs.map(d => d.data() as GoalDoc),
        invSnap.docs.map(d => d.data() as InvestmentDoc),
        liabSnap.docs.map(d => d.data() as LiabilityDoc),
      );

      const docId = `${userFreq}-${payload.asOf}`;
      await userRef.collection('digests').doc(docId).set({
        ...payload,
        // Email send status — flips to 'sent' once provider integration ships.
        deliveryStatus: 'pending',
        createdAt: now.toISOString(),
      });
      written += 1;
    }

    logger.info('digestCron wrote', { written, due: [...due] });
  },
);
