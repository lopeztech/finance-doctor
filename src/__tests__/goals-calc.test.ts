import {
  balanceForGoal,
  computeGoalProgress,
  dailyVelocity,
  milestoneLabel,
  nextGoalMilestoneToFire,
  statusColor,
  statusLabel,
  suggestEmergencyFundTarget,
} from '@/lib/goals-calc';
import type { Goal } from '@/lib/goals-types';
import type { Investment } from '@/lib/types';

const inv = (id: string, value: number, type: string = 'Cash / Term Deposit'): Investment => ({
  id, name: id, type, currentValue: value, costBasis: value,
});

const baseGoal: Goal = {
  id: 'g1',
  name: 'House deposit',
  category: 'house',
  targetAmount: 100000,
  targetDate: '2027-01-01',
  linkedInvestments: ['i1', 'i2'],
  startedAt: '2026-01-01T00:00:00Z',
  monthlyContribution: 3000,
};

describe('balanceForGoal', () => {
  it('sums currentValue across linked investments', () => {
    const balance = balanceForGoal(baseGoal, [inv('i1', 30000), inv('i2', 20000), inv('i3', 999999)]);
    expect(balance).toBe(50000);
  });

  it('skips deleted or non-finite investments', () => {
    const balance = balanceForGoal(baseGoal, [
      inv('i1', NaN as unknown as number),
      inv('i2', 7500),
    ]);
    expect(balance).toBe(7500);
  });

  it('returns 0 when no investments are linked', () => {
    expect(balanceForGoal({ ...baseGoal, linkedInvestments: [] }, [inv('i1', 1000)])).toBe(0);
  });
});

describe('dailyVelocity', () => {
  it('uses monthlyContribution when set', () => {
    expect(dailyVelocity({ ...baseGoal, monthlyContribution: 3000 })).toBeCloseTo(100);
  });

  it('returns 0 when no contribution rate is recorded', () => {
    expect(dailyVelocity({ ...baseGoal, monthlyContribution: undefined })).toBe(0);
    expect(dailyVelocity({ ...baseGoal, monthlyContribution: 0 })).toBe(0);
  });
});

describe('computeGoalProgress', () => {
  it('marks goals at or above target as completed', () => {
    const progress = computeGoalProgress({ ...baseGoal, targetAmount: 1000 }, [inv('i1', 1500)]);
    expect(progress.status).toBe('completed');
    expect(progress.fraction).toBe(1);
    expect(progress.daysToTarget).toBe(0);
    expect(progress.remaining).toBe(0);
  });

  it('produces a projected date when velocity is non-zero', () => {
    const progress = computeGoalProgress(
      { ...baseGoal, targetAmount: 100000, monthlyContribution: 3000 },
      [inv('i1', 30000), inv('i2', 10000)],
    );
    // 60k remaining at $100/day → 600 days. Should yield a finite projection.
    expect(progress.daysToTarget).toBeGreaterThan(0);
    expect(progress.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns no projection when velocity is zero', () => {
    const progress = computeGoalProgress(
      { ...baseGoal, monthlyContribution: 0 },
      [inv('i1', 10000)],
    );
    expect(progress.projectedDate).toBeNull();
    expect(progress.daysToTarget).toBeNull();
  });

  it('flags as on-track when projection is comfortably before deadline', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    // 30k saved, $5k/mo, 100k target — 14 months at ~$166/day → ~420 days from
    // April 2026 lands around June 2027, well before the 2030 deadline.
    const progress = computeGoalProgress(
      { ...baseGoal, targetDate: '2030-01-01', monthlyContribution: 5000 },
      [inv('i1', 30000)],
      now,
    );
    expect(progress.status).toBe('ahead');
  });

  it('flags as behind when projection is past the deadline', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    const progress = computeGoalProgress(
      { ...baseGoal, targetDate: '2026-06-01', monthlyContribution: 100 },
      [inv('i1', 1000)],
      now,
    );
    expect(progress.status).toBe('behind');
  });

  it('reports no-deadline when targetDate is missing', () => {
    const progress = computeGoalProgress(
      { ...baseGoal, targetDate: undefined, monthlyContribution: 0 },
      [inv('i1', 1000)],
    );
    expect(progress.status).toBe('no-deadline');
  });
});

describe('nextGoalMilestoneToFire', () => {
  it('returns the highest milestone crossed on first eval', () => {
    expect(nextGoalMilestoneToFire(baseGoal, 0.3)).toBe(0.25);
    expect(nextGoalMilestoneToFire(baseGoal, 0.5)).toBe(0.5);
    expect(nextGoalMilestoneToFire(baseGoal, 0.99)).toBe(0.75);
    expect(nextGoalMilestoneToFire(baseGoal, 1)).toBe(1);
  });

  it('returns null when nothing has been crossed', () => {
    expect(nextGoalMilestoneToFire(baseGoal, 0.1)).toBeNull();
  });

  it('does not refire a milestone already alerted on', () => {
    const after50: Goal = { ...baseGoal, lastAlertedMilestone: 0.5 };
    expect(nextGoalMilestoneToFire(after50, 0.5)).toBeNull();
    expect(nextGoalMilestoneToFire(after50, 0.7)).toBeNull();
    expect(nextGoalMilestoneToFire(after50, 0.8)).toBe(0.75);
  });

  it('does not refire 100% once alerted', () => {
    const completed: Goal = { ...baseGoal, lastAlertedMilestone: 1 };
    expect(nextGoalMilestoneToFire(completed, 1.5)).toBeNull();
  });
});

describe('suggestEmergencyFundTarget', () => {
  it('returns 3× the average of monthly totals', () => {
    expect(suggestEmergencyFundTarget({ '2026-01': 5000, '2026-02': 6000, '2026-03': 7000 })).toBe(18000);
  });

  it('ignores non-positive entries', () => {
    expect(suggestEmergencyFundTarget({ '2026-01': 0, '2026-02': 5000 })).toBe(15000);
  });

  it('returns 0 when there is no data', () => {
    expect(suggestEmergencyFundTarget({})).toBe(0);
  });
});

describe('label helpers', () => {
  it('statusLabel covers every status', () => {
    expect(statusLabel('completed')).toBe('Completed');
    expect(statusLabel('ahead')).toBe('Ahead of schedule');
    expect(statusLabel('on-track')).toBe('On track');
    expect(statusLabel('behind')).toBe('Behind');
    expect(statusLabel('no-deadline')).toBe('No deadline');
  });

  it('statusColor maps each status to a Bootstrap colour', () => {
    expect(statusColor('completed')).toBe('success');
    expect(statusColor('ahead')).toBe('success');
    expect(statusColor('on-track')).toBe('primary');
    expect(statusColor('behind')).toBe('danger');
    expect(statusColor('no-deadline')).toBe('secondary');
  });

  it('milestoneLabel renders fractions as integer percent', () => {
    expect(milestoneLabel(0.25)).toBe('25%');
    expect(milestoneLabel(1)).toBe('100%');
  });
});
