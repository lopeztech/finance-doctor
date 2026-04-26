import type { Expense } from './types';
import {
  DEFAULT_THRESHOLDS,
  type Budget,
  type BudgetProgress,
  type BudgetScope,
} from './budgets-types';

/** Returns `YYYY-MM` for the calendar month containing `date`. */
export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns the previous-month key for a `YYYY-MM` value. */
export function previousMonth(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** True if a budget applies to the supplied expense at all. */
function matches(budget: Budget, expense: Expense): boolean {
  if (budget.scope === 'overall') return true;
  if (budget.scope === 'spending-category') {
    return Boolean(budget.category) && expense.spendingCategory === budget.category;
  }
  // spending-sub-category
  return (
    Boolean(budget.category) && Boolean(budget.subCategory)
    && expense.spendingCategory === budget.category
    && expense.spendingSubCategory === budget.subCategory
  );
}

/** Sum spend for `budget` against `expenses` falling in `month` (`YYYY-MM`). */
export function spendForMonth(budget: Budget, expenses: Expense[], month: string): number {
  let total = 0;
  for (const e of expenses) {
    if (!e?.date || typeof e.amount !== 'number') continue;
    if (e.date.slice(0, 7) !== month) continue;
    if (!matches(budget, e)) continue;
    total += e.amount;
  }
  return total;
}

/**
 * Surplus that rolls into the current month from the previous one. Capped at
 * 1× budget.amount so credit doesn't accumulate forever (per issue spec).
 * Returns 0 when rollover is disabled or the current month is the first.
 */
export function rolloverInForMonth(budget: Budget, expenses: Expense[], month: string): number {
  if (!budget.rolloverUnused) return 0;
  if (month <= budget.startMonth) return 0;
  const prev = previousMonth(month);
  const prevSpend = spendForMonth(budget, expenses, prev);
  const surplus = budget.amount - prevSpend;
  if (surplus <= 0) return 0;
  return Math.min(surplus, budget.amount);
}

/** Compute progress for a single budget for the supplied month. */
export function computeProgress(
  budget: Budget,
  expenses: Expense[],
  month: string,
): BudgetProgress {
  const spent = spendForMonth(budget, expenses, month);
  const rolloverIn = rolloverInForMonth(budget, expenses, month);
  const effectiveCap = Math.max(0.01, budget.amount + rolloverIn);
  const rawRatio = spent / effectiveCap;
  const ratio = Math.min(1.5, rawRatio);
  const level: BudgetProgress['level'] =
    rawRatio >= 1 ? 'red' : rawRatio >= 0.8 ? 'amber' : 'green';
  return { budget, month, spent, rolloverIn, effectiveCap, ratio, level };
}

/**
 * Returns the highest threshold the budget has crossed this `month` that hasn't
 * already been alerted on, or null if there's nothing new to fire.
 *
 * The dedupe rules:
 * - When `lastAlertedMonth` differs from `month`, the threshold counter resets
 *   so each new month gets fresh alerts.
 * - Within a month, only thresholds STRICTLY GREATER than `lastAlertedThreshold`
 *   trigger again.
 */
export function nextThresholdToAlert(
  budget: Budget,
  spent: number,
  effectiveCap: number,
  month: string,
): number | null {
  const ratio = spent / effectiveCap;
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

export function describeBudget(budget: Budget): string {
  if (budget.scope === 'overall') return 'Overall monthly spending';
  if (budget.scope === 'spending-sub-category') {
    return `${budget.category} → ${budget.subCategory}`;
  }
  return budget.category ?? 'Uncategorised';
}

export function thresholdLabel(threshold: number): string {
  return `${Math.round(threshold * 100)}%`;
}

export function describeScope(scope: BudgetScope): string {
  switch (scope) {
    case 'overall': return 'Overall';
    case 'spending-category': return 'Category';
    case 'spending-sub-category': return 'Sub-category';
  }
}
