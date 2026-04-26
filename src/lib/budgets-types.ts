export type BudgetScope = 'overall' | 'spending-category' | 'spending-sub-category';

export interface Budget {
  id: string;
  scope: BudgetScope;
  /** Required for `spending-category` and `spending-sub-category`. */
  category?: string;
  /** Required for `spending-sub-category`. */
  subCategory?: string;
  /** Monthly cap, in dollars. */
  amount: number;
  period: 'monthly';
  /** First month this budget is active, `YYYY-MM`. */
  startMonth: string;
  rolloverUnused: boolean;
  /** Fractions of `amount` at which to alert, e.g. [0.8, 1.0, 1.2]. */
  alertThresholds: number[];
  /** Set by the cron when an alert fires — used to dedupe. `YYYY-MM`. */
  lastAlertedMonth?: string;
  /** Highest threshold (fraction) already alerted on for `lastAlertedMonth`. */
  lastAlertedThreshold?: number;
}

export const DEFAULT_THRESHOLDS = [0.8, 1.0, 1.2] as const;

export interface BudgetProgress {
  budget: Budget;
  /** Calendar month under evaluation, `YYYY-MM`. */
  month: string;
  /** Plain MTD spend for the budget's scope. */
  spent: number;
  /** Carried-forward surplus from the previous month (0 if rollover disabled). */
  rolloverIn: number;
  /** Effective cap = budget.amount + rolloverIn. */
  effectiveCap: number;
  /** spent / effectiveCap, capped at 1.5 for the visual bar. */
  ratio: number;
  /** UI severity bucket. */
  level: 'green' | 'amber' | 'red';
}
