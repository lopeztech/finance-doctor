'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { listInvestments } from '@/lib/investments-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';
import {
  addLiability,
  deleteLiability,
  listLiabilities,
  updateLiability,
} from '@/lib/liabilities-repo';
import {
  listNetWorthHistory,
  saveNetWorthSnapshot,
} from '@/lib/networth-history-repo';
import {
  computeNetWorth,
  deltaVs,
  NET_WORTH_JOINT_KEY,
  snapshotFromSummary,
} from '@/lib/networth-calc';
import {
  LIABILITY_KIND_ICON,
  LIABILITY_KIND_LABEL,
  type Liability,
  type LiabilityKind,
  type NetWorthSnapshot,
} from '@/lib/networth-types';
import { formatCurrency } from '@/lib/format';
import { usePreferences } from '@/lib/use-preferences';
import { monthKey } from '@/lib/budgets-calc';
import type { FamilyMember, Investment } from '@/lib/types';

const KIND_OPTIONS: LiabilityKind[] = [
  'mortgage', 'personal-loan', 'car-loan', 'student-loan', 'credit-card', 'other',
];

interface LiabilityFormState {
  name: string;
  kind: LiabilityKind;
  owner: string;
  currentBalance: string;
  originalAmount: string;
  interestRate: string;
  minMonthlyPayment: string;
}

const EMPTY_LIABILITY_FORM: LiabilityFormState = {
  name: '',
  kind: 'mortgage',
  owner: '',
  currentBalance: '',
  originalAmount: '',
  interestRate: '',
  minMonthlyPayment: '',
};

function deltaBadge(delta: number): { className: string; arrow: string } {
  if (delta > 0) return { className: 'text-success', arrow: '▲' };
  if (delta < 0) return { className: 'text-danger', arrow: '▼' };
  return { className: 'text-muted', arrow: '–' };
}

export default function NetWorthPage() {
  const { prefs } = usePreferences();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [excludeSuper, setExcludeSuper] = useState(false);
  const [form, setForm] = useState<LiabilityFormState>(EMPTY_LIABILITY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  useEffect(() => {
    Promise.all([
      listInvestments(),
      listLiabilities(),
      listFamilyMembers(),
      listNetWorthHistory(),
    ])
      .then(([inv, liab, fam, hist]) => {
        setInvestments(inv);
        setLiabilities(liab);
        setMembers(fam);
        setHistory(hist);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(
    () => computeNetWorth(investments, liabilities, { excludeSuper }),
    [investments, liabilities, excludeSuper],
  );

  // Resolve last-month and last-year deltas using stored history when available.
  const month = monthKey(new Date());
  const prevMonthKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  }, [month]);
  const prevYearKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return `${y - 1}-${String(m).padStart(2, '0')}`;
  }, [month]);

  const lastMonthSnap = history.find(h => h.id === prevMonthKey);
  const lastYearSnap = history.find(h => h.id === prevYearKey);

  const monthDelta = deltaVs(summary.netWorth, lastMonthSnap?.netWorth);
  const yearDelta = deltaVs(summary.netWorth, lastYearSnap?.netWorth);

  const memberLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const fm of members) m.set(fm.id, fm.name);
    return m;
  }, [members]);

  const memberRows = useMemo(() => {
    const rows = Object.entries(summary.netWorthByMember).map(([key, value]) => ({
      key,
      label: key === NET_WORTH_JOINT_KEY ? 'Joint / unassigned' : (memberLookup.get(key) || key),
      value,
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [summary.netWorthByMember, memberLookup]);

  const allocationRows = useMemo(() => {
    const total = summary.totalAssets || 1;
    return Object.entries(summary.assetsByClass)
      .map(([cls, value]) => ({ cls, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [summary.assetsByClass, summary.totalAssets]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const snap = snapshotFromSummary(month, summary);
      await saveNetWorthSnapshot(snap);
      const next = await listNetWorthHistory();
      setHistory(next);
    } finally {
      setSnapshotting(false);
    }
  };

  const resetForm = () => { setForm(EMPTY_LIABILITY_FORM); setEditingId(null); setError(null); };

  const beginEditLiability = (l: Liability) => {
    setEditingId(l.id);
    setForm({
      name: l.name,
      kind: l.kind,
      owner: l.owner || '',
      currentBalance: String(l.currentBalance),
      originalAmount: String(l.originalAmount),
      interestRate: l.interestRate ? String(l.interestRate) : '',
      minMonthlyPayment: l.minMonthlyPayment ? String(l.minMonthlyPayment) : '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const balance = parseFloat(form.currentBalance);
    const original = parseFloat(form.originalAmount) || balance;
    if (!form.name.trim()) { setError('Give the liability a name.'); return; }
    if (!Number.isFinite(balance) || balance < 0) { setError('Balance must be 0 or greater.'); return; }
    setSaving(true);
    try {
      const data: Omit<Liability, 'id'> = {
        name: form.name.trim(),
        kind: form.kind,
        owner: form.owner || undefined,
        currentBalance: balance,
        originalAmount: original,
        ...(form.interestRate ? { interestRate: parseFloat(form.interestRate) } : {}),
        ...(form.minMonthlyPayment ? { minMonthlyPayment: parseFloat(form.minMonthlyPayment) } : {}),
      };
      if (editingId) {
        await updateLiability(editingId, data);
      } else {
        const added = await addLiability(data);
        setLiabilities(prev => [...prev, added]);
      }
      const fresh = await listLiabilities();
      setLiabilities(fresh);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this liability?')) return;
    await deleteLiability(id);
    const fresh = await listLiabilities();
    setLiabilities(fresh);
    if (editingId === id) resetForm();
  };

  const monthDeltaClasses = deltaBadge(monthDelta.delta);
  const yearDeltaClasses = deltaBadge(yearDelta.delta);

  return (
    <>
      <h1 className="page-header">Net Worth</h1>

      {loading ? (
        <div className="text-muted small"><i className="fa fa-spinner fa-spin me-1"></i>Loading…</div>
      ) : (
        <>
          <Panel className="mb-3">
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-scale-balanced me-2"></i>Current snapshot
                <div className="ms-auto d-flex gap-3 align-items-center">
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      id="exclude-super"
                      type="checkbox"
                      checked={excludeSuper}
                      onChange={e => setExcludeSuper(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="exclude-super">Exclude super</label>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={handleSnapshot}
                    disabled={snapshotting}
                  >
                    {snapshotting ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving</> : <><i className="fa fa-camera me-1"></i>Save snapshot</>}
                  </button>
                </div>
              </div>
            </PanelHeader>
            <PanelBody>
              <div className="row align-items-center mb-3">
                <div className="col-md-5">
                  <div className="text-muted small">Net worth</div>
                  <div className="display-5 fw-bold">{formatCurrency(summary.netWorth, prefs)}</div>
                  <div className="d-flex gap-3 mt-1 small">
                    <span className={monthDeltaClasses.className}>
                      {monthDeltaClasses.arrow} {formatCurrency(monthDelta.delta, prefs)} vs last month
                      {lastMonthSnap && ` (${monthDelta.pct.toFixed(1)}%)`}
                    </span>
                    <span className={yearDeltaClasses.className}>
                      {yearDeltaClasses.arrow} {formatCurrency(yearDelta.delta, prefs)} vs last year
                      {lastYearSnap && ` (${yearDelta.pct.toFixed(1)}%)`}
                    </span>
                  </div>
                  {!lastMonthSnap && !lastYearSnap && (
                    <small className="text-muted d-block mt-1">
                      Save a snapshot today to start tracking the trend.
                    </small>
                  )}
                </div>
                <div className="col-md-7">
                  <div className="row text-center">
                    <div className="col-4">
                      <div className="text-muted small">Assets</div>
                      <div className="h5 mb-0 text-success">{formatCurrency(summary.totalAssets, prefs)}</div>
                    </div>
                    <div className="col-4">
                      <div className="text-muted small">Liabilities</div>
                      <div className="h5 mb-0 text-danger">{formatCurrency(summary.totalLiabilities, prefs)}</div>
                    </div>
                    <div className="col-4">
                      <div className="text-muted small">Super held</div>
                      <div className="h5 mb-0">{formatCurrency(summary.superValue, prefs)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <div className="row">
            <div className="col-lg-6 mb-3">
              <Panel>
                <PanelHeader noButton><i className="fa fa-users me-2"></i>By household member</PanelHeader>
                <PanelBody>
                  {memberRows.length === 0 ? (
                    <div className="text-muted small">Nothing to show — add an investment or liability.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {memberRows.map(row => (
                        <li key={row.key} className="list-group-item d-flex justify-content-between px-0">
                          <span>{row.label}</span>
                          <strong className={row.value < 0 ? 'text-danger' : ''}>
                            {formatCurrency(row.value, prefs)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelBody>
              </Panel>
            </div>

            <div className="col-lg-6 mb-3">
              <Panel>
                <PanelHeader noButton><i className="fa fa-chart-pie me-2"></i>Asset allocation</PanelHeader>
                <PanelBody>
                  {allocationRows.length === 0 ? (
                    <div className="text-muted small">No assets yet.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {allocationRows.map(row => (
                        <li key={row.cls} className="list-group-item px-0">
                          <div className="d-flex justify-content-between mb-1">
                            <span>{row.cls}</span>
                            <span>{formatCurrency(row.value, prefs)} <span className="text-muted small ms-1">{row.pct.toFixed(1)}%</span></span>
                          </div>
                          <div className="progress" style={{ height: 4 }}>
                            <div className="progress-bar bg-primary" style={{ width: `${Math.min(100, row.pct)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelBody>
              </Panel>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-7 mb-3">
              <Panel>
                <PanelHeader noButton><i className="fa fa-credit-card me-2"></i>Liabilities</PanelHeader>
                <PanelBody>
                  {liabilities.length === 0 ? (
                    <div className="text-muted text-center py-3">No liabilities tracked yet.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {liabilities.map(l => (
                        <li key={l.id} className="list-group-item px-0">
                          <div className="d-flex align-items-start gap-2">
                            <i className={`fa ${LIABILITY_KIND_ICON[l.kind]} fa-fw mt-1 text-danger`}></i>
                            <div className="flex-grow-1">
                              <div className="d-flex justify-content-between">
                                <strong>{l.name}</strong>
                                <span className="text-danger">{formatCurrency(l.currentBalance, prefs)}</span>
                              </div>
                              <div className="text-muted small">
                                {LIABILITY_KIND_LABEL[l.kind]}
                                {l.interestRate ? ` · ${l.interestRate}% p.a.` : ''}
                                {l.owner ? ` · ${memberLookup.get(l.owner) || l.owner}` : ' · joint'}
                              </div>
                              <div className="small mt-1">
                                <button className="btn btn-link btn-sm p-0 me-2" onClick={() => beginEditLiability(l)}>Edit</button>
                                <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => handleDelete(l.id)}>Delete</button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelBody>
              </Panel>
            </div>

            <div className="col-lg-5 mb-3">
              <Panel>
                <PanelHeader noButton>
                  <i className={`fa ${editingId ? 'fa-pen-to-square' : 'fa-plus'} me-2`}></i>
                  {editingId ? 'Edit liability' : 'Add liability'}
                </PanelHeader>
                <PanelBody>
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label small text-muted">Name</label>
                      <input type="text" className="form-control form-control-sm"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. ANZ home loan" />
                    </div>
                    <div className="row g-2">
                      <div className="col-6 mb-3">
                        <label className="form-label small text-muted">Kind</label>
                        <select className="form-select form-select-sm"
                          value={form.kind}
                          onChange={e => setForm(f => ({ ...f, kind: e.target.value as LiabilityKind }))}>
                          {KIND_OPTIONS.map(k => <option key={k} value={k}>{LIABILITY_KIND_LABEL[k]}</option>)}
                        </select>
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label small text-muted">Owner</label>
                        <select className="form-select form-select-sm"
                          value={form.owner}
                          onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                          <option value="">Joint / unassigned</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="row g-2">
                      <div className="col-6 mb-3">
                        <label className="form-label small text-muted">Current balance</label>
                        <input type="number" min={0} step="0.01" className="form-control form-control-sm"
                          value={form.currentBalance}
                          onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} />
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label small text-muted">Original amount</label>
                        <input type="number" min={0} step="0.01" className="form-control form-control-sm"
                          value={form.originalAmount}
                          onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))} />
                      </div>
                    </div>
                    <div className="row g-2">
                      <div className="col-6 mb-3">
                        <label className="form-label small text-muted">Interest rate (% p.a.)</label>
                        <input type="number" min={0} step="0.01" className="form-control form-control-sm"
                          value={form.interestRate}
                          onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} />
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label small text-muted">Min monthly payment</label>
                        <input type="number" min={0} step="0.01" className="form-control form-control-sm"
                          value={form.minMonthlyPayment}
                          onChange={e => setForm(f => ({ ...f, minMonthlyPayment: e.target.value }))} />
                      </div>
                    </div>
                    {error && <div className="text-danger small mb-2">{error}</div>}
                    <div className="d-flex gap-2">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                        {saving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving</> : editingId ? 'Save changes' : 'Add liability'}
                      </button>
                      {editingId && (
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetForm}>Cancel</button>
                      )}
                    </div>
                  </form>
                </PanelBody>
              </Panel>
            </div>
          </div>

          {history.length > 0 && (
            <Panel className="mb-3">
              <PanelHeader noButton><i className="fa fa-chart-line me-2"></i>Trend ({history.length} snapshot{history.length === 1 ? '' : 's'})</PanelHeader>
              <PanelBody>
                <ul className="list-group list-group-flush">
                  {[...history].reverse().slice(0, 12).map(h => (
                    <li key={h.id} className="list-group-item d-flex justify-content-between px-0 small">
                      <span>{h.id}</span>
                      <span>
                        Net <strong>{formatCurrency(h.netWorth, prefs)}</strong>
                        <span className="text-muted ms-2">
                          A {formatCurrency(h.totalAssets, prefs)} · L {formatCurrency(h.totalLiabilities, prefs)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
