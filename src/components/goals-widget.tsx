'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { watchGoals } from '@/lib/goals-repo';
import { listInvestments } from '@/lib/investments-repo';
import { computeGoalProgress, statusColor, statusLabel } from '@/lib/goals-calc';
import { GOAL_CATEGORY_META, type Goal } from '@/lib/goals-types';
import { formatCurrency } from '@/lib/format';
import { usePreferences } from '@/lib/use-preferences';
import type { Investment } from '@/lib/types';

export default function GoalsWidget() {
  const { prefs } = usePreferences();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const off = watchGoals(setGoals);
    listInvestments()
      .then(setInvestments)
      .catch(() => setInvestments([]))
      .finally(() => setLoaded(true));
    return () => off();
  }, []);

  if (!loaded) return null;
  const active = goals.filter(g => !g.archivedAt);
  if (active.length === 0) return null;

  const top = active
    .map(g => computeGoalProgress(g, investments))
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, 3);

  return (
    <Panel className="mb-3">
      <PanelHeader noButton>
        <div className="d-flex align-items-center">
          <i className="fa fa-bullseye me-2"></i>Savings goals
          <Link href="/goals" className="ms-auto small text-decoration-none">View all</Link>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="row">
          {top.map(p => {
            const meta = GOAL_CATEGORY_META[p.goal.category];
            const color = statusColor(p.status);
            return (
              <div key={p.goal.id} className="col-md-4 mb-2 mb-md-0">
                <div className="d-flex align-items-start gap-2">
                  <i className={`fa ${meta.icon} fa-fw mt-1`} style={{ color: meta.color }}></i>
                  <div className="flex-grow-1">
                    <div className="small">{p.goal.name}</div>
                    <div className={`small text-${color}`}>
                      {formatCurrency(p.currentBalance, prefs)} / {formatCurrency(p.goal.targetAmount, prefs)}
                    </div>
                    <div className="progress mt-1" style={{ height: 6 }}>
                      <div
                        className={`progress-bar bg-${color}`}
                        style={{ width: `${Math.min(100, p.fraction * 100)}%` }}
                      />
                    </div>
                    <div className="small text-muted mt-1">{statusLabel(p.status)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PanelBody>
    </Panel>
  );
}
