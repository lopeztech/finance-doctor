import { computeProgress, monthKey, previousMonth } from './budgets-calc';
import { computeNetWorth, deltaVs } from './networth-calc';
import { computeGoalProgress } from './goals-calc';
import type { Budget } from './budgets-types';
import type { Goal } from './goals-types';
import type { Liability, NetWorthSnapshot } from './networth-types';
import type { Expense, Investment } from './types';

export type DigestPeriod = 'weekly' | 'monthly' | 'quarterly';

export interface DigestPayload {
  period: DigestPeriod;
  /** ISO date the digest covers up to. */
  asOf: string;
  totalSpend: number;
  topCategories: { category: string; total: number }[];
  budgetBreaches: { name: string; spent: number; cap: number; ratio: number }[];
  goalProgress: { name: string; fraction: number; remaining: number }[];
  netWorth: number;
  netWorthDelta: number;
  highlight: string;
}

interface DigestInput {
  period: DigestPeriod;
  expenses: Expense[];
  budgets: Budget[];
  goals: Goal[];
  investments: Investment[];
  liabilities: Liability[];
  netWorthHistory: NetWorthSnapshot[];
  /** Anchor date — for testing. Defaults to now. */
  now?: Date;
}

function startOfPeriod(period: DigestPeriod, now: Date): Date {
  const d = new Date(now);
  if (period === 'weekly') {
    d.setDate(d.getDate() - 7);
  } else if (period === 'monthly') {
    d.setMonth(d.getMonth() - 1);
  } else {
    d.setMonth(d.getMonth() - 3);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeDigest(input: DigestInput): DigestPayload {
  const now = input.now ?? new Date();
  const start = startOfPeriod(input.period, now);

  // Spend roll-up over the period.
  const periodExpenses = input.expenses.filter(e => {
    if (!e?.date || typeof e.amount !== 'number') return false;
    const d = new Date(e.date + 'T00:00:00');
    return d >= start && d <= now;
  });
  const totalSpend = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const e of periodExpenses) {
    const key = e.spendingCategory || 'Other';
    byCategory[key] = (byCategory[key] || 0) + e.amount;
  }
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, total]) => ({ category, total }));

  // Budget breaches as of the current month.
  const month = monthKey(now);
  const budgetBreaches = input.budgets
    .map(b => computeProgress(b, input.expenses, month))
    .filter(p => p.ratio >= 1)
    .map(p => ({
      name: p.budget.scope === 'overall' ? 'Overall' : (p.budget.category || 'Uncategorised'),
      spent: p.spent,
      cap: p.effectiveCap,
      ratio: p.ratio,
    }));

  // Active goal progress.
  const goalProgress = input.goals
    .filter(g => !g.archivedAt)
    .map(g => computeGoalProgress(g, input.investments, now))
    .map(p => ({
      name: p.goal.name,
      fraction: p.fraction,
      remaining: p.remaining,
    }));

  // Net worth + delta vs the snapshot at start of period (best effort — we
  // store one per month so for weekly digests we use the most recent snapshot).
  const summary = computeNetWorth(input.investments, input.liabilities);
  const targetMonth = input.period === 'weekly' ? month : previousMonth(month);
  const lastSnap = input.netWorthHistory.find(h => h.id === targetMonth);
  const netWorthDelta = deltaVs(summary.netWorth, lastSnap?.netWorth).delta;

  // One-line highlight prioritising the most actionable thing.
  let highlight: string;
  if (budgetBreaches.length > 0) {
    const worst = budgetBreaches.reduce((a, b) => a.ratio > b.ratio ? a : b);
    highlight = `${worst.name} budget at ${Math.round(worst.ratio * 100)}% — review before month end.`;
  } else if (goalProgress.some(g => g.fraction >= 1)) {
    const completed = goalProgress.find(g => g.fraction >= 1)!;
    highlight = `🎯 ${completed.name} reached its target!`;
  } else if (netWorthDelta > 0) {
    highlight = `Net worth up ${Math.round(Math.abs(netWorthDelta)).toLocaleString('en-AU')} this period — keep going.`;
  } else if (netWorthDelta < 0) {
    highlight = `Net worth down ${Math.round(Math.abs(netWorthDelta)).toLocaleString('en-AU')} this period — worth a closer look.`;
  } else {
    highlight = 'Steady period — no breaches, no surprises.';
  }

  return {
    period: input.period,
    asOf: isoDate(now),
    totalSpend,
    topCategories,
    budgetBreaches,
    goalProgress,
    netWorth: summary.netWorth,
    netWorthDelta,
    highlight,
  };
}

/** Convenience: emit a plain-text digest body the cron logs (and a future email renderer can re-use). */
export function renderDigestText(payload: DigestPayload): string {
  const lines: string[] = [];
  lines.push(`Finance Doctor — ${payload.period} digest (as of ${payload.asOf})`);
  lines.push('');
  lines.push(`Highlight: ${payload.highlight}`);
  lines.push('');
  lines.push(`Total spend this period: $${payload.totalSpend.toFixed(2)}`);
  if (payload.topCategories.length > 0) {
    lines.push('Top categories:');
    for (const tc of payload.topCategories) {
      lines.push(`  - ${tc.category}: $${tc.total.toFixed(2)}`);
    }
  }
  if (payload.budgetBreaches.length > 0) {
    lines.push('');
    lines.push('Budget breaches:');
    for (const b of payload.budgetBreaches) {
      lines.push(`  - ${b.name}: $${b.spent.toFixed(0)} / $${b.cap.toFixed(0)} (${Math.round(b.ratio * 100)}%)`);
    }
  }
  if (payload.goalProgress.length > 0) {
    lines.push('');
    lines.push('Goals:');
    for (const g of payload.goalProgress) {
      lines.push(`  - ${g.name}: ${Math.round(g.fraction * 100)}%`);
    }
  }
  lines.push('');
  lines.push(`Net worth: $${payload.netWorth.toFixed(0)} (Δ $${payload.netWorthDelta.toFixed(0)})`);
  return lines.join('\n');
}
