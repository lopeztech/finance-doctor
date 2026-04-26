'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { addGoal, deleteGoal, updateGoal, watchGoals } from '@/lib/goals-repo';
import { listInvestments } from '@/lib/investments-repo';
import {
  computeGoalProgress,
  statusColor,
  statusLabel,
  suggestEmergencyFundTarget,
} from '@/lib/goals-calc';
import {
  GOAL_CATEGORY_META,
  GOAL_CATEGORY_OPTIONS,
  type Goal,
  type GoalCategory,
} from '@/lib/goals-types';
import { listExpenses } from '@/lib/expenses-repo';
import { formatCurrency } from '@/lib/format';
import { usePreferences } from '@/lib/use-preferences';
import type { Expense, Investment } from '@/lib/types';
import { monthKey } from '@/lib/budgets-calc';

interface FormState {
  name: string;
  category: GoalCategory;
  targetAmount: string;
  targetDate: string;
  monthlyContribution: string;
  linkedInvestments: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'house',
  targetAmount: '',
  targetDate: '',
  monthlyContribution: '',
  linkedInvestments: [],
};

function isCashLike(inv: Investment): boolean {
  return inv.type === 'Cash / Term Deposit';
}

function monthlyTotalsFromExpenses(expenses: Expense[], lastNMonths: number): Record<string, number> {
  const totals: Record<string, number> = {};
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - lastNMonths);
  for (const e of expenses) {
    if (!e?.date || typeof e.amount !== 'number') continue;
    const d = new Date(e.date + 'T00:00:00');
    if (d < cutoff) continue;
    const key = e.date.slice(0, 7);
    totals[key] = (totals[key] || 0) + e.amount;
  }
  return totals;
}

export default function GoalsPage() {
  const { prefs } = usePreferences();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const off = watchGoals(setGoals);
    Promise.all([
      listInvestments().catch(() => []),
      listExpenses('all').catch(() => []),
    ])
      .then(([inv, exp]) => { setInvestments(inv); setExpenses(exp); })
      .finally(() => setLoading(false));
    return () => off();
  }, []);

  const visibleGoals = useMemo(
    () => goals.filter(g => showArchived ? Boolean(g.archivedAt) : !g.archivedAt),
    [goals, showArchived],
  );

  const progress = useMemo(
    () => visibleGoals.map(g => computeGoalProgress(g, investments)),
    [visibleGoals, investments],
  );

  const emergencyFundSuggestion = useMemo(
    () => suggestEmergencyFundTarget(monthlyTotalsFromExpenses(expenses, 3)),
    [expenses],
  );

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setError(null); };

  const beginEdit = (g: Goal) => {
    setEditingId(g.id);
    setForm({
      name: g.name,
      category: g.category,
      targetAmount: String(g.targetAmount),
      targetDate: g.targetDate || '',
      monthlyContribution: g.monthlyContribution ? String(g.monthlyContribution) : '',
      linkedInvestments: [...g.linkedInvestments],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(form.targetAmount);
    if (!form.name.trim()) { setError('Give the goal a name.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError('Target amount must be positive.'); return; }
    setSaving(true);
    try {
      const data: Omit<Goal, 'id'> = {
        name: form.name.trim(),
        category: form.category,
        targetAmount: amount,
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
        ...(form.monthlyContribution
          ? { monthlyContribution: parseFloat(form.monthlyContribution) }
          : {}),
        linkedInvestments: form.linkedInvestments,
        startedAt: editingId
          ? (goals.find(g => g.id === editingId)?.startedAt || new Date().toISOString())
          : new Date().toISOString(),
      };
      if (editingId) await updateGoal(editingId, data);
      else await addGoal(data);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (g: Goal) => {
    if (g.archivedAt) {
      await updateGoal(g.id, { archivedAt: undefined });
    } else {
      await updateGoal(g.id, { archivedAt: new Date().toISOString() });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal? Archive instead if you want to keep history.')) return;
    await deleteGoal(id);
    if (editingId === id) resetForm();
  };

  const handleToggleInvestment = (id: string) => {
    setForm(f => ({
      ...f,
      linkedInvestments: f.linkedInvestments.includes(id)
        ? f.linkedInvestments.filter(x => x !== id)
        : [...f.linkedInvestments, id],
    }));
  };

  const applyEmergencyFundPreset = () => {
    if (!emergencyFundSuggestion) return;
    setForm(f => ({
      ...f,
      name: f.name || 'Emergency fund',
      category: 'emergency-fund',
      targetAmount: String(emergencyFundSuggestion),
      linkedInvestments: investments.filter(isCashLike).map(i => i.id),
    }));
  };

  return (
    <>
      <h1 className="page-header">Savings Goals</h1>

      <div className="row">
        <div className="col-lg-7 mb-3">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-bullseye me-2"></i>
                {showArchived ? 'Archived goals' : 'Active goals'}
                <button
                  type="button"
                  className="btn btn-link btn-sm ms-auto p-0"
                  onClick={() => setShowArchived(s => !s)}
                >
                  {showArchived ? 'View active' : 'View archived'}
                </button>
              </div>
            </PanelHeader>
            <PanelBody>
              {loading ? (
                <div className="text-muted small"><i className="fa fa-spinner fa-spin me-1"></i>Loading…</div>
              ) : progress.length === 0 ? (
                <div className="text-muted text-center py-4">
                  <i className="fa fa-bullseye fa-2x d-block mb-2 text-muted"></i>
                  {showArchived
                    ? 'No archived goals — completed or paused goals show up here.'
                    : 'No active goals yet — create one on the right to start tracking progress.'}
                </div>
              ) : (
                <ul className="list-group list-group-flush">
                  {progress.map(p => {
                    const meta = GOAL_CATEGORY_META[p.goal.category];
                    const color = statusColor(p.status);
                    return (
                      <li key={p.goal.id} className="list-group-item px-0">
                        <div className="d-flex align-items-start gap-2">
                          <i className={`fa ${meta.icon} fa-fw mt-1`} style={{ color: meta.color }}></i>
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between flex-wrap">
                              <span>
                                <strong>{p.goal.name}</strong>
                                <span className={`badge bg-${color} ms-2`}>{statusLabel(p.status)}</span>
                              </span>
                              <span>
                                {formatCurrency(p.currentBalance, prefs)} / {formatCurrency(p.goal.targetAmount, prefs)}
                              </span>
                            </div>
                            <div className="progress mt-1" style={{ height: 8 }}>
                              <div
                                className={`progress-bar bg-${color}`}
                                style={{ width: `${Math.min(100, p.fraction * 100)}%` }}
                              />
                            </div>
                            <div className="d-flex justify-content-between mt-1 small text-muted flex-wrap">
                              <span>
                                {p.goal.targetDate ? `Target ${p.goal.targetDate}` : 'Open-ended'}
                                {p.projectedDate && p.status !== 'completed' && ` · projected ${p.projectedDate}`}
                                {p.velocity > 0 && ` · ${formatCurrency(p.velocity * 30, prefs)}/mo`}
                              </span>
                              <span>
                                <button className="btn btn-link btn-sm p-0 me-2" onClick={() => beginEdit(p.goal)}>Edit</button>
                                <button className="btn btn-link btn-sm p-0 me-2" onClick={() => handleArchiveToggle(p.goal)}>
                                  {p.goal.archivedAt ? 'Restore' : 'Archive'}
                                </button>
                                <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => handleDelete(p.goal.id)}>Delete</button>
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="col-lg-5 mb-3">
          <Panel>
            <PanelHeader noButton>
              <i className={`fa ${editingId ? 'fa-pen-to-square' : 'fa-plus'} me-2`}></i>
              {editingId ? 'Edit goal' : 'New goal'}
            </PanelHeader>
            <PanelBody>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small text-muted">Name</label>
                  <input type="text" className="form-control form-control-sm"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. House deposit by 2027" />
                </div>
                <div className="row g-2">
                  <div className="col-6 mb-3">
                    <label className="form-label small text-muted">Category</label>
                    <select className="form-select form-select-sm"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value as GoalCategory }))}>
                      {GOAL_CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{GOAL_CATEGORY_META[c].label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label small text-muted">Target date</label>
                    <input type="date" className="form-control form-control-sm"
                      value={form.targetDate}
                      onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-6 mb-3">
                    <label className="form-label small text-muted">Target amount (AUD)</label>
                    <input type="number" min={1} step="0.01" className="form-control form-control-sm"
                      value={form.targetAmount}
                      onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label small text-muted">Monthly contribution</label>
                    <input type="number" min={0} step="0.01" className="form-control form-control-sm"
                      value={form.monthlyContribution}
                      onChange={e => setForm(f => ({ ...f, monthlyContribution: e.target.value }))} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small text-muted">Linked investments</label>
                  {investments.length === 0 ? (
                    <div className="text-muted small">No investments to link yet.</div>
                  ) : (
                    <div className="border rounded p-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {investments.map(inv => (
                        <div key={inv.id} className="form-check">
                          <input className="form-check-input" type="checkbox"
                            id={`link-${inv.id}`}
                            checked={form.linkedInvestments.includes(inv.id)}
                            onChange={() => handleToggleInvestment(inv.id)} />
                          <label className="form-check-label small" htmlFor={`link-${inv.id}`}>
                            {inv.name} <span className="text-muted">({inv.type})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {emergencyFundSuggestion > 0 && !editingId && (
                  <div className="alert alert-info py-2 small mb-3">
                    Emergency-fund preset: 3 × your average monthly spend ≈ <strong>{formatCurrency(emergencyFundSuggestion, prefs)}</strong>.{' '}
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={applyEmergencyFundPreset}>Apply preset</button>
                  </div>
                )}
                {error && <div className="text-danger small mb-2">{error}</div>}
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving</> : editingId ? 'Save changes' : 'Add goal'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetForm}>Cancel</button>
                  )}
                </div>
              </form>
              <hr className="my-4" />
              <div className="small text-muted">
                Milestone notifications fire at 25% / 50% / 75% / 100%, routed via the in-app bell using the
                <strong> Savings goals</strong> per-kind preference (Settings → Notifications).
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
