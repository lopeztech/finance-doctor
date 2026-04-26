'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { addBudget, deleteBudget, updateBudget, watchBudgets } from '@/lib/budgets-repo';
import { listExpenses } from '@/lib/expenses-repo';
import {
  computeProgress,
  describeBudget,
  monthKey,
  thresholdLabel,
} from '@/lib/budgets-calc';
import {
  DEFAULT_THRESHOLDS,
  type Budget,
  type BudgetScope,
} from '@/lib/budgets-types';
import { DEFAULT_SPENDING_CATEGORIES, spendingIcon } from '@/lib/spending-categories';
import { formatCurrency } from '@/lib/format';
import { usePreferences } from '@/lib/use-preferences';
import type { Expense } from '@/lib/types';

const LEVEL_BG: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-danger',
};

const LEVEL_TEXT: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-success',
  amber: 'text-warning',
  red: 'text-danger',
};

interface FormState {
  scope: BudgetScope;
  category: string;
  subCategory: string;
  amount: string;
  rolloverUnused: boolean;
}

const EMPTY_FORM: FormState = {
  scope: 'spending-category',
  category: 'Groceries',
  subCategory: '',
  amount: '500',
  rolloverUnused: false,
};

export default function BudgetsPage() {
  const { prefs } = usePreferences();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = monthKey(new Date());

  useEffect(() => {
    const off = watchBudgets(setBudgets);
    listExpenses('all')
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
    return () => off();
  }, []);

  const progress = useMemo(
    () => budgets.map(b => computeProgress(b, expenses, month)),
    [budgets, expenses, month],
  );

  const sorted = useMemo(
    () => [...progress].sort((a, b) => b.ratio - a.ratio),
    [progress],
  );

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setError(null); };

  const beginEdit = (b: Budget) => {
    setEditingId(b.id);
    setForm({
      scope: b.scope,
      category: b.category || 'Groceries',
      subCategory: b.subCategory || '',
      amount: String(b.amount),
      rolloverUnused: b.rolloverUnused,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    if (form.scope !== 'overall' && !form.category) {
      setError('Pick a category.');
      return;
    }
    if (form.scope === 'spending-sub-category' && !form.subCategory.trim()) {
      setError('Sub-category cannot be blank for that scope.');
      return;
    }
    setSaving(true);
    try {
      const data: Omit<Budget, 'id'> = {
        scope: form.scope,
        amount,
        period: 'monthly',
        startMonth: month,
        rolloverUnused: form.rolloverUnused,
        alertThresholds: [...DEFAULT_THRESHOLDS],
        ...(form.scope !== 'overall' ? { category: form.category } : {}),
        ...(form.scope === 'spending-sub-category' ? { subCategory: form.subCategory.trim() } : {}),
      };
      if (editingId) {
        await updateBudget(editingId, data);
      } else {
        await addBudget(data);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    await deleteBudget(id);
    if (editingId === id) resetForm();
  };

  const totalCap = sorted.reduce((sum, p) => sum + p.budget.amount, 0);
  const totalSpent = sorted.reduce((sum, p) => sum + p.spent, 0);
  const overall = totalCap > 0 ? Math.min(1.5, totalSpent / totalCap) : 0;

  return (
    <>
      <h1 className="page-header">Budgets</h1>

      <div className="row">
        <div className="col-lg-7 mb-3">
          <Panel>
            <PanelHeader noButton>
              <i className="fa fa-gauge-high me-2"></i>Live Progress · {month}
            </PanelHeader>
            <PanelBody>
              {loading ? (
                <div className="text-muted small"><i className="fa fa-spinner fa-spin me-1"></i>Loading…</div>
              ) : sorted.length === 0 ? (
                <div className="text-muted text-center py-4">
                  <i className="fa fa-bullseye fa-2x d-block mb-2 text-muted"></i>
                  No budgets yet — add one on the right to start tracking.
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="d-flex justify-content-between mb-1">
                      <strong>All budgets combined</strong>
                      <span>
                        {formatCurrency(totalSpent, prefs)} / {formatCurrency(totalCap, prefs)}
                      </span>
                    </div>
                    <div className="progress" style={{ height: 10 }}>
                      <div
                        className={`progress-bar ${overall >= 1 ? 'bg-danger' : overall >= 0.8 ? 'bg-warning' : 'bg-success'}`}
                        style={{ width: `${Math.min(100, (overall / 1.5) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <ul className="list-group list-group-flush">
                    {sorted.map(p => (
                      <li key={p.budget.id} className="list-group-item px-0">
                        <div className="d-flex align-items-start gap-2">
                          <i className={`fa ${spendingIcon(p.budget.category)} fa-fw mt-1 ${LEVEL_TEXT[p.level]}`}></i>
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between">
                              <span>
                                <strong>{describeBudget(p.budget)}</strong>
                                {p.budget.rolloverUnused && (
                                  <span className="badge bg-info ms-2">rollover</span>
                                )}
                              </span>
                              <span className={LEVEL_TEXT[p.level]}>
                                {formatCurrency(p.spent, prefs)} / {formatCurrency(p.effectiveCap, prefs)}
                                {p.rolloverIn > 0 && (
                                  <small className="text-muted ms-1">(+{formatCurrency(p.rolloverIn, prefs)} rollover)</small>
                                )}
                              </span>
                            </div>
                            <div className="progress mt-1" style={{ height: 8 }}>
                              <div
                                className={`progress-bar ${LEVEL_BG[p.level]}`}
                                style={{ width: `${Math.min(100, (p.ratio / 1.5) * 100)}%` }}
                              />
                            </div>
                            <div className="d-flex justify-content-between mt-1 small text-muted">
                              <span>
                                Alerts at {p.budget.alertThresholds.map(thresholdLabel).join(' · ')}
                              </span>
                              <span>
                                <button className="btn btn-link btn-sm p-0 me-2" onClick={() => beginEdit(p.budget)}>Edit</button>
                                <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => handleDelete(p.budget.id)}>Delete</button>
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="col-lg-5 mb-3">
          <Panel>
            <PanelHeader noButton>
              <i className={`fa ${editingId ? 'fa-pen-to-square' : 'fa-plus'} me-2`}></i>
              {editingId ? 'Edit budget' : 'New budget'}
            </PanelHeader>
            <PanelBody>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small text-muted">Scope</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.scope}
                    onChange={e => setForm(f => ({ ...f, scope: e.target.value as BudgetScope }))}
                  >
                    <option value="overall">Overall (all spending)</option>
                    <option value="spending-category">Category</option>
                    <option value="spending-sub-category">Sub-category</option>
                  </select>
                </div>
                {form.scope !== 'overall' && (
                  <div className="mb-3">
                    <label className="form-label small text-muted">Category</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {DEFAULT_SPENDING_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
                {form.scope === 'spending-sub-category' && (
                  <div className="mb-3">
                    <label className="form-label small text-muted">Sub-category</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Coffee, Streaming"
                      value={form.subCategory}
                      onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))}
                    />
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label small text-muted">Monthly cap (AUD)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    className="form-control form-control-sm"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    id="rollover"
                    type="checkbox"
                    checked={form.rolloverUnused}
                    onChange={e => setForm(f => ({ ...f, rolloverUnused: e.target.checked }))}
                  />
                  <label className="form-check-label small" htmlFor="rollover">
                    Roll unused budget into next month (capped at 1× cap)
                  </label>
                </div>
                {error && <div className="text-danger small mb-2">{error}</div>}
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving</> : editingId ? 'Save changes' : 'Add budget'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
              <hr className="my-4" />
              <div className="small text-muted">
                Alerts fire at 80%, 100% and 120% of the effective cap. They route through your in-app
                bell using the per-kind preference for <strong>Budget alerts</strong> (configurable in
                Settings → Notifications).
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
