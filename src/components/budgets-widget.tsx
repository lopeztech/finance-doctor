'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { watchBudgets } from '@/lib/budgets-repo';
import { listExpenses } from '@/lib/expenses-repo';
import {
  computeProgress,
  describeBudget,
  monthKey,
} from '@/lib/budgets-calc';
import type { Budget } from '@/lib/budgets-types';
import { formatCurrency } from '@/lib/format';
import { spendingIcon } from '@/lib/spending-categories';
import { usePreferences } from '@/lib/use-preferences';
import type { Expense } from '@/lib/types';

const LEVEL_TEXT: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-success',
  amber: 'text-warning',
  red: 'text-danger',
};

const LEVEL_BG: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-danger',
};

export default function BudgetsWidget() {
  const { prefs } = usePreferences();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const off = watchBudgets(setBudgets);
    listExpenses('all')
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoaded(true));
    return () => off();
  }, []);

  if (!loaded || budgets.length === 0) return null;

  const month = monthKey(new Date());
  const top = budgets
    .map(b => computeProgress(b, expenses, month))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  return (
    <Panel className="mb-3">
      <PanelHeader noButton>
        <div className="d-flex align-items-center">
          <i className="fa fa-gauge-high me-2"></i>Budgets · top 3
          <Link href="/budgets" className="ms-auto small text-decoration-none">View all</Link>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="row">
          {top.map(p => (
            <div key={p.budget.id} className="col-md-4 mb-2 mb-md-0">
              <div className="d-flex align-items-start gap-2">
                <i className={`fa ${spendingIcon(p.budget.category)} fa-fw mt-1 ${LEVEL_TEXT[p.level]}`}></i>
                <div className="flex-grow-1">
                  <div className="small">{describeBudget(p.budget)}</div>
                  <div className={`small ${LEVEL_TEXT[p.level]}`}>
                    {formatCurrency(p.spent, prefs)} / {formatCurrency(p.effectiveCap, prefs)}
                  </div>
                  <div className="progress mt-1" style={{ height: 6 }}>
                    <div
                      className={`progress-bar ${LEVEL_BG[p.level]}`}
                      style={{ width: `${Math.min(100, (p.ratio / 1.5) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}
