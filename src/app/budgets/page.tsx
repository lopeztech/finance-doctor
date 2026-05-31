'use client';

import { useEffect, useMemo, useState } from 'react';
import { addBudget, deleteBudget, updateBudget, watchBudgets } from '@/lib/budgets-repo';
import { listExpenses } from '@/lib/expenses-repo';
import { computeProgress, describeBudget, monthKey, thresholdLabel } from '@/lib/budgets-calc';
import { DEFAULT_THRESHOLDS, type Budget, type BudgetScope } from '@/lib/budgets-types';
import { DEFAULT_SPENDING_CATEGORIES, spendingIcon } from '@/lib/spending-categories';
import { formatCurrency } from '@/lib/format';
import { usePreferences } from '@/lib/use-preferences';
import type { Expense } from '@/lib/types';

interface FormState {
  scope: BudgetScope; category: string; subCategory: string;
  amount: string; rolloverUnused: boolean;
}
const EMPTY_FORM: FormState = {
  scope: 'spending-category', category: 'Groceries', subCategory: '', amount: '500', rolloverUnused: false,
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
    listExpenses('all').then(setExpenses).catch(() => setExpenses([])).finally(() => setLoading(false));
    return () => off();
  }, []);

  const progress = useMemo(() => budgets.map(b => computeProgress(b, expenses, month)), [budgets, expenses, month]);
  const sorted   = useMemo(() => [...progress].sort((a, b) => b.ratio - a.ratio), [progress]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setError(null); };
  const beginEdit = (b: Budget) => {
    setEditingId(b.id);
    setForm({ scope: b.scope, category: b.category || 'Groceries', subCategory: b.subCategory || '', amount: String(b.amount), rolloverUnused: b.rolloverUnused });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Amount must be a positive number.'); return; }
    if (form.scope !== 'overall' && !form.category) { setError('Pick a category.'); return; }
    setSaving(true);
    try {
      const data: Omit<Budget, 'id'> = {
        scope: form.scope, amount, period: 'monthly', startMonth: month,
        rolloverUnused: form.rolloverUnused, alertThresholds: [...DEFAULT_THRESHOLDS],
        ...(form.scope !== 'overall' ? { category: form.category } : {}),
        ...(form.scope === 'spending-sub-category' ? { subCategory: form.subCategory.trim() } : {}),
      };
      if (editingId) await updateBudget(editingId, data);
      else await addBudget(data);
      resetForm();
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    await deleteBudget(id);
    if (editingId === id) resetForm();
  };

  const totalCap   = sorted.reduce((s, p) => s + p.budget.amount, 0);
  const totalSpent = sorted.reduce((s, p) => s + p.spent, 0);
  const overCount  = sorted.filter(p => p.ratio >= 1).length;
  const overBudget = sorted.filter(p => p.ratio >= 1).map(p => describeBudget(p.budget)).join(' · ');

  const levelColor = (level: 'green' | 'amber' | 'red') =>
    level === 'red' ? 'var(--fd-red)' : level === 'amber' ? 'var(--fd-amber)' : 'var(--fd-green)';
  const barClass = (level: 'green' | 'amber' | 'red') =>
    level === 'red' ? 'bg-red' : level === 'amber' ? 'bg-amber' : 'bg-green';

  const today = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  return (
    <main className="report">
      {/* ── Report head ── */}
      <div className="report-head">
        <div className="lead">
          <div className="eyebrow">Budgets · {today}</div>
          <h1>Budgets</h1>
          <p className="dek">
            {sorted.length > 0
              ? <>{totalCap > 0 ? `${Math.round((totalSpent / totalCap) * 100)}% spent overall` : 'Tracking'} across <b>{sorted.length} budget{sorted.length !== 1 ? 's' : ''}</b>.{overCount > 0 ? ` ${overCount} over cap: ${overBudget}.` : ' All on track.'}</>
              : <>Add your first budget cap to start tracking spending against targets.</>}
          </p>
        </div>
        <div className="meta">
          <div className="big">{today}</div>
          Alerts at 80 · 100 · 120%<br />
          {sorted.length} active budget{sorted.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── 01 This Month ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">01</span>
          <h2>This Month</h2>
          <div className="agg">
            {totalCap > 0 ? `${Math.round((totalSpent / totalCap) * 100)}% of caps used` : ''}
          </div>
        </div>

        {totalCap > 0 && (
          <>
            <div className="alloc-bar" style={{ height: 24, marginBottom: 8 }}>
              <span style={{ width: `${Math.min(100, (totalSpent / totalCap) * 100)}%`,
                background: totalSpent > totalCap ? 'var(--fd-red)' : totalSpent / totalCap > 0.8 ? 'var(--fd-amber)' : 'var(--fd-teal)' }}></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 22 }}>
              <span>Spent: {formatCurrency(totalSpent, prefs)}</span>
              <span>Cap: {formatCurrency(totalCap, prefs)}</span>
            </div>
          </>
        )}

        <div className="ledger">
          <div className="cell">
            <div className="k">Total caps</div>
            <div className="v num">{formatCurrency(totalCap, prefs)}</div>
            <div className="sub">Across {sorted.length} budget{sorted.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="cell">
            <div className="k">Spent so far</div>
            <div className="v num" style={{ color: totalSpent > totalCap ? 'var(--fd-red)' : 'var(--fd-amber)' }}>{formatCurrency(totalSpent, prefs)}</div>
            <div className="sub">{totalCap > 0 ? `${Math.round((totalSpent / totalCap) * 100)}% of caps` : '—'}</div>
          </div>
          <div className="cell">
            <div className="k">Remaining</div>
            <div className={`v num ${totalCap - totalSpent >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(Math.abs(totalCap - totalSpent), prefs)}</div>
            <div className="sub">{totalCap - totalSpent >= 0 ? 'Under cap' : 'Over cap'}</div>
          </div>
          <div className="cell">
            <div className="k">Over budget</div>
            <div className="v num" style={{ color: overCount > 0 ? 'var(--fd-red)' : 'var(--ink-2)' }}>{overCount}</div>
            <div className="sub">{overCount > 0 ? overBudget.slice(0, 30) : 'All on track'}</div>
          </div>
        </div>
      </section>

      {/* ── 02 Live Progress ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">02</span>
          <h2>Live Progress</h2>
          <div className="agg">Ranked by % of cap used</div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            <i className="fa fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '16px 0' }}>
            No budgets yet — add one in the section below to start tracking.
          </div>
        ) : (
          <div className="budgets">
            {sorted.map(p => (
              <div key={p.budget.id} className="bg">
                <div className="bg-top">
                  <span className="ic"><i className={`fa ${spendingIcon(p.budget.category)}`} style={{ color: levelColor(p.level) }}></i></span>
                  <span className="nm">{describeBudget(p.budget)}</span>
                  <span className="sp" style={{ color: levelColor(p.level) }}>
                    {formatCurrency(p.spent, prefs)} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>/ {formatCurrency(p.effectiveCap, prefs)}</span>
                  </span>
                </div>
                <div className="bg-bar">
                  <span className={barClass(p.level)} style={{ width: `${Math.min(100, (p.ratio / 1.5) * 100)}%` }}></span>
                </div>
                <div className="bg-meta">
                  <span className={`lvl-${p.level}`}>
                    {p.ratio >= 1.2 ? '120%+ — over budget' : p.ratio >= 1 ? '100%+ — cap reached' : p.ratio >= 0.8 ? '80%+ — approaching cap' : 'On track'}
                    {p.rolloverIn > 0 && ` · +${formatCurrency(p.rolloverIn, prefs)} rollover`}
                  </span>
                  <span style={{ display: 'flex', gap: 12 }}>
                    <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-teal)', fontSize: 11.5, fontWeight: 700 }} onClick={() => beginEdit(p.budget)}>Edit</button>
                    <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-red)', fontSize: 11.5, fontWeight: 700 }} onClick={() => handleDelete(p.budget.id)}>Delete</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="disclaimer">
          <i className="fa fa-bell"></i> Alerts fire at 80%, 100%, and 120% of each cap, routed through in-app notifications. Budgets with rollover carry unused funds into next month (capped at 1× cap).
        </p>
      </section>

      {/* ── 03 New/Edit Budget ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">03</span>
          <h2>{editingId ? 'Edit Budget' : 'New Budget'}</h2>
          <div className="agg">Set a monthly cap</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="qform" style={{ gridTemplateColumns: 'repeat(4,1fr) auto' }}>
            <div className="fld">
              <label>Scope</label>
              <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as BudgetScope }))}>
                <option value="spending-category">Category</option>
                <option value="spending-sub-category">Sub-category</option>
                <option value="overall">Overall (all spending)</option>
              </select>
            </div>
            {form.scope !== 'overall' && (
              <div className="fld">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {DEFAULT_SPENDING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="fld">
              <label>Monthly cap (AUD)</label>
              <input type="number" min={1} step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="fld">
              <label>Rollover unused</label>
              <select value={form.rolloverUnused ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, rolloverUnused: e.target.value === 'yes' }))}>
                <option value="no">No</option>
                <option value="yes">Yes — carry into next month</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-fill btn-sm" disabled={saving}>
                <i className={`fa ${saving ? 'fa-spinner fa-spin' : editingId ? 'fa-check' : 'fa-plus'}`}></i>
                {saving ? ' Saving…' : editingId ? ' Save' : ' Add budget'}
              </button>
              {editingId && <button type="button" className="btn btn-sm" onClick={resetForm}>Cancel</button>}
            </div>
          </div>
          {error && <div style={{ color: 'var(--fd-red)', fontSize: 12, marginTop: 8 }}>{error}</div>}
        </form>
      </section>

      {/* ── Footer ── */}
      <footer className="report-footer">
        <span className="rf-brand"><i className="fa fa-user-doctor"></i> Finance Doctor</span>
        <span>Budgets · {today}</span>
        <span className="rf-end">General information only — not financial advice.</span>
      </footer>
    </main>
  );
}
