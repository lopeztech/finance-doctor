export type GoalCategory =
  | 'house'
  | 'holiday'
  | 'education'
  | 'retirement'
  | 'emergency-fund'
  | 'other';

export interface Goal {
  id: string;
  name: string;
  category: GoalCategory;
  targetAmount: number;
  /** ISO date (YYYY-MM-DD). Optional — open-ended goals omit it. */
  targetDate?: string;
  /** Investment doc ids whose currentValue rolls into this goal's progress. */
  linkedInvestments: string[];
  /** Reserved for bank-feed integration; stored but unused for now. */
  linkedAccounts?: string[];
  /** User-stated monthly contribution (used as a fallback velocity until 90 days of history accrues). */
  monthlyContribution?: number;
  /** ISO timestamp the goal was first created. */
  startedAt: string;
  /** ISO timestamp; presence excludes the goal from the active list. */
  archivedAt?: string;
  /** Server-managed: highest milestone fraction already alerted on. */
  lastAlertedMilestone?: number;
}

export const GOAL_CATEGORY_META: Record<GoalCategory, { label: string; icon: string; color: string }> = {
  'house': { label: 'House deposit', icon: 'fa-house-chimney', color: '#0d6efd' },
  'holiday': { label: 'Holiday', icon: 'fa-plane', color: '#fd7e14' },
  'education': { label: 'Education', icon: 'fa-graduation-cap', color: '#6f42c1' },
  'retirement': { label: 'Retirement top-up', icon: 'fa-piggy-bank', color: '#198754' },
  'emergency-fund': { label: 'Emergency fund', icon: 'fa-shield-halved', color: '#dc3545' },
  'other': { label: 'Other', icon: 'fa-bullseye', color: '#6c757d' },
};

export const GOAL_CATEGORY_OPTIONS = Object.keys(GOAL_CATEGORY_META) as GoalCategory[];

/** Milestone fractions we fire `goal-milestone` notifications on. */
export const GOAL_MILESTONES = [0.25, 0.5, 0.75, 1.0] as const;
