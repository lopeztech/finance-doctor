import type { Investment } from './types';
import {
  GOAL_MILESTONES,
  type Goal,
} from './goals-types';

export type GoalStatus = 'on-track' | 'ahead' | 'behind' | 'completed' | 'no-deadline';

export interface GoalProgress {
  goal: Goal;
  currentBalance: number;
  fraction: number;
  /** AUD per day, derived from history when available, otherwise from monthlyContribution. */
  velocity: number;
  /** Days until projected hit at current velocity. null when no velocity. */
  daysToTarget: number | null;
  /** ISO date, or null when projection is unknown. */
  projectedDate: string | null;
  status: GoalStatus;
  remaining: number;
}

/**
 * Sum currentValue across the linked investments. Missing investments are
 * silently ignored — they may have been deleted since the goal was created.
 */
export function balanceForGoal(goal: Goal, investments: Investment[]): number {
  if (!goal.linkedInvestments?.length) return 0;
  const set = new Set(goal.linkedInvestments);
  return investments
    .filter(i => set.has(i.id) && typeof i.currentValue === 'number' && Number.isFinite(i.currentValue))
    .reduce((sum, i) => sum + i.currentValue, 0);
}

/**
 * Velocity in dollars/day. The issue calls for "(current - balance 90 days
 * ago) / 90 days" — but we don't store balance history per investment, so we
 * approximate with `monthlyContribution / 30` when set, otherwise 0.
 */
export function dailyVelocity(goal: Goal): number {
  if (typeof goal.monthlyContribution === 'number' && goal.monthlyContribution > 0) {
    return goal.monthlyContribution / 30;
  }
  return 0;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + Math.round(days));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDays(aIso: string, bIso: string): number {
  const a = new Date(aIso + 'T00:00:00').getTime();
  const b = new Date(bIso + 'T00:00:00').getTime();
  return Math.round((a - b) / 86_400_000);
}

export function computeGoalProgress(
  goal: Goal,
  investments: Investment[],
  now: Date = new Date(),
): GoalProgress {
  const currentBalance = balanceForGoal(goal, investments);
  const target = goal.targetAmount;
  const remaining = Math.max(0, target - currentBalance);
  const fraction = target <= 0 ? 0 : Math.min(1, currentBalance / target);
  const velocity = dailyVelocity(goal);

  let daysToTarget: number | null = null;
  let projectedDate: string | null = null;
  if (currentBalance >= target) {
    daysToTarget = 0;
    projectedDate = todayIso(now);
  } else if (velocity > 0) {
    daysToTarget = Math.ceil(remaining / velocity);
    projectedDate = addDays(todayIso(now), daysToTarget);
  }

  let status: GoalStatus;
  if (currentBalance >= target) {
    status = 'completed';
  } else if (!goal.targetDate) {
    status = 'no-deadline';
  } else if (projectedDate === null) {
    // No velocity yet — call it on-track if the deadline is still in the
    // future, behind otherwise.
    status = goal.targetDate >= todayIso(now) ? 'on-track' : 'behind';
  } else {
    const slackDays = diffDays(goal.targetDate, projectedDate);
    if (slackDays < 0) status = 'behind';
    // 10% of the time-to-go counts as "ahead" — guards against flapping when
    // a goal is very close to the deadline.
    else if (slackDays > Math.max(7, diffDays(goal.targetDate, todayIso(now)) * 0.1)) status = 'ahead';
    else status = 'on-track';
  }

  return { goal, currentBalance, fraction, velocity, daysToTarget, projectedDate, status, remaining };
}

/**
 * Returns the highest milestone the goal has crossed that hasn't yet been
 * alerted on. Mirrors the budget threshold dedupe but without month rollover —
 * milestones only fire once over the goal's lifetime (and reset only on
 * archive + restart).
 */
export function nextGoalMilestoneToFire(goal: Goal, fraction: number): number | null {
  const ceiling = goal.lastAlertedMilestone ?? -Infinity;
  let next: number | null = null;
  for (const m of GOAL_MILESTONES) {
    if (fraction >= m && m > ceiling) next = m;
  }
  return next;
}

/**
 * Suggest an emergency-fund target = 3 × average monthly total spend.
 * `monthlyTotalsByYM` maps YYYY-MM to a month's total spend.
 */
export function suggestEmergencyFundTarget(monthlyTotalsByYM: Record<string, number>): number {
  const values = Object.values(monthlyTotalsByYM).filter(v => Number.isFinite(v) && v > 0);
  if (values.length === 0) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.round(avg * 3);
}

export function statusLabel(status: GoalStatus): string {
  switch (status) {
    case 'completed': return 'Completed';
    case 'ahead': return 'Ahead of schedule';
    case 'on-track': return 'On track';
    case 'behind': return 'Behind';
    case 'no-deadline': return 'No deadline';
  }
}

export function statusColor(status: GoalStatus): string {
  switch (status) {
    case 'completed': return 'success';
    case 'ahead': return 'success';
    case 'on-track': return 'primary';
    case 'behind': return 'danger';
    case 'no-deadline': return 'secondary';
  }
}

export function milestoneLabel(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
