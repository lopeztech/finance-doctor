'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { FamilyMember, Investment, Expense, IncomeSource, IncomeSourceType, IncomeCadence, Income, EmploymentType } from '@/lib/types';
import { effectiveSalary } from '@/lib/types';
import { listFamilyMembers, addFamilyMember, updateFamilyMember, deleteFamilyMember } from '@/lib/family-members-repo';
import { listInvestments } from '@/lib/investments-repo';
import { listExpenses } from '@/lib/expenses-repo';
import { listIncomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource } from '@/lib/income-sources-repo';
import { listIncome, deleteIncome, updateIncome } from '@/lib/income-repo';
import { getCategorySettings, type CategorySettings, type SpendingCategoryType } from '@/lib/category-settings-repo';
import { computeCashflow, type CashflowSnapshot } from '@/lib/cashflow-calc';
import { ViewToggle, useViewMode } from '@/components/view-toggle';
import { PeriodFilter } from '@/components/period-filter';
import { dateInRange, type Period } from '@/lib/period';
import { useMember } from '@/lib/use-member';

const INCOME_TYPES: { value: IncomeSourceType; label: string; icon: string }[] = [
  { value: 'dividend', label: 'Dividend', icon: 'fa-chart-line' },
  { value: 'interest', label: 'Interest', icon: 'fa-percent' },
  { value: 'side', label: 'Side income', icon: 'fa-briefcase' },
  { value: 'other', label: 'Other', icon: 'fa-circle-dollar-to-slot' },
];

const INCOME_TX_TYPE_ORDER = ['Salary', 'Dividend', 'Interest', 'Side Income', 'Other Income', 'Rental'] as const;
type IncomeTxType = typeof INCOME_TX_TYPE_ORDER[number];
const INCOME_TX_ICONS: Record<IncomeTxType, string> = {
  'Salary': 'fa-briefcase',
  'Dividend': 'fa-chart-line',
  'Interest': 'fa-percent',
  'Side Income': 'fa-laptop-code',
  'Other Income': 'fa-circle-dollar-to-slot',
  'Rental': 'fa-house',
};
const INCOME_TX_COLORS: Record<IncomeTxType, string> = {
  'Salary': '#0d6efd',
  'Dividend': '#20c997',
  'Interest': '#ffc107',
  'Side Income': '#6f42c1',
  'Other Income': '#6c757d',
  'Rental': '#dc3545',
};

const CADENCES: IncomeCadence[] = ['weekly', 'fortnightly', 'monthly', 'annual'];

const TYPE_META: Record<SpendingCategoryType | 'unclassified', { label: string; color: string }> = {
  essential: { label: 'Essential', color: '#198754' },
  committed: { label: 'Committed', color: '#fd7e14' },
  discretionary: { label: 'Discretionary', color: '#dc3545' },
  unclassified: { label: 'Unclassified', color: '#adb5bd' },
};
const TYPE_ORDER: (SpendingCategoryType | 'unclassified')[] = ['essential', 'committed', 'discretionary', 'unclassified'];

type View = 'monthly' | 'annual';

function fmt(amount: number): string {
  return amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CashflowPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [period, setPeriod] = useState<Period>(null);
  const { memberId } = useMember();
  const [expandedIncomeTypes, setExpandedIncomeTypes] = useState<Set<string>>(new Set());

  const toggleIncomeType = (t: string) => {
    setExpandedIncomeTypes(prev => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t); else n.add(t);
      return n;
    });
  };
  const [categorySettings, setCategorySettings] = useState<CategorySettings>({ types: {}, excluded: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('monthly');
  const [mode, setMode] = useViewMode('viewMode.cashflow');

  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState<{ name: string; job: string; salary: string; superSalarySacrifice: string; employmentType: EmploymentType; daysPerWeek: string }>({
    name: '', job: '', salary: '', superSalarySacrifice: '', employmentType: 'full-time', daysPerWeek: '5',
  });
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeForm, setIncomeForm] = useState<{ type: IncomeSourceType; description: string; amount: string; cadence: IncomeCadence; owner: string }>({
    type: 'dividend', description: '', amount: '', cadence: 'annual', owner: '',
  });
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, inv, exp, inc, incomeTx, settings] = await Promise.all([
        listFamilyMembers(),
        listInvestments(),
        listExpenses('all'),
        listIncomeSources(),
        listIncome().catch(() => [] as Income[]),
        getCategorySettings(),
      ]);
      setMembers(m);
      setInvestments(inv);
      setExpenses(exp);
      setIncomeSources(inc);
      setIncome(incomeTx);
      setCategorySettings(settings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const submitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPartTime = memberForm.employmentType === 'part-time';
    const daysRaw = parseFloat(memberForm.daysPerWeek);
    const days = Number.isFinite(daysRaw) ? Math.min(5, Math.max(0.5, daysRaw)) : 5;
    const body: Omit<FamilyMember, 'id'> = {
      name: memberForm.name,
      salary: parseFloat(memberForm.salary) || 0,
      ...(memberForm.job ? { job: memberForm.job } : {}),
      ...(memberForm.superSalarySacrifice ? { superSalarySacrifice: parseFloat(memberForm.superSalarySacrifice) } : {}),
      ...(isPartTime ? { employmentType: 'part-time', daysPerWeek: days } : {}),
    };
    if (editingMemberId) {
      await updateFamilyMember(editingMemberId, body);
      setMembers(prev => prev.map(m => m.id === editingMemberId ? { id: m.id, ...body } : m));
    } else {
      const created = await addFamilyMember(body);
      setMembers(prev => [...prev, created]);
    }
    cancelMemberForm();
  };

  const editMember = (m: FamilyMember) => {
    setMemberForm({
      name: m.name,
      job: m.job || '',
      salary: String(m.salary),
      superSalarySacrifice: m.superSalarySacrifice ? String(m.superSalarySacrifice) : '',
      employmentType: m.employmentType || 'full-time',
      daysPerWeek: m.daysPerWeek ? String(m.daysPerWeek) : '5',
    });
    setEditingMemberId(m.id);
    setShowMemberForm(true);
  };
  const cancelMemberForm = () => {
    setMemberForm({ name: '', job: '', salary: '', superSalarySacrifice: '', employmentType: 'full-time', daysPerWeek: '5' });
    setEditingMemberId(null);
    setShowMemberForm(false);
  };
  const removeMember = async (id: string) => {
    await deleteFamilyMember(id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const submitIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Omit<IncomeSource, 'id'> = {
      type: incomeForm.type,
      description: incomeForm.description,
      amount: parseFloat(incomeForm.amount) || 0,
      cadence: incomeForm.cadence,
      ...(incomeForm.owner ? { owner: incomeForm.owner } : {}),
    };
    if (editingIncomeId) {
      await updateIncomeSource(editingIncomeId, body);
      setIncomeSources(prev => prev.map(i => i.id === editingIncomeId ? { ...i, ...body } : i));
    } else {
      const created = await addIncomeSource(body);
      setIncomeSources(prev => [...prev, created]);
    }
    cancelIncomeForm();
  };
  const editIncome = (i: IncomeSource) => {
    setIncomeForm({
      type: i.type,
      description: i.description,
      amount: String(i.amount),
      cadence: i.cadence,
      owner: i.owner || '',
    });
    setEditingIncomeId(i.id);
    setShowIncomeForm(true);
  };
  const cancelIncomeForm = () => {
    setIncomeForm({ type: 'dividend', description: '', amount: '', cadence: 'annual', owner: '' });
    setEditingIncomeId(null);
    setShowIncomeForm(false);
  };
  const removeIncome = async (id: string) => {
    await deleteIncomeSource(id);
    setIncomeSources(prev => prev.filter(i => i.id !== id));
  };

  if (loading) {
    return (
      <>
        <h1 className="page-header">Cashflow</h1>
        <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      </>
    );
  }

  const matchesFilters = (date: string, owner: string | undefined): boolean => {
    if (!dateInRange(date, period)) return false;
    if (memberId && owner !== memberId) return false;
    return true;
  };

  const filteredExpenses = expenses.filter(e => matchesFilters(e.date, e.owner));
  const filteredIncome = income.filter(r => matchesFilters(r.date, r.owner));
  const anyFilterActive = memberId !== '' || period !== null;

  const snap: CashflowSnapshot = computeCashflow({ members, investments, expenses: filteredExpenses, incomeSources, categorySettings, income: filteredIncome });

  const removeIncomeRow = async (id: string) => {
    await deleteIncome(id);
    setIncome(prev => prev.filter(i => i.id !== id));
  };

  const reassignIncomeOwner = async (id: string, nextOwner: string) => {
    const prevRow = income.find(r => r.id === id);
    if (!prevRow) return;
    const patch: Partial<Income> = nextOwner ? { owner: nextOwner } : { owner: undefined };
    setIncome(prev => prev.map(r => {
      if (r.id !== id) return r;
      const { owner: _drop, ...rest } = r;
      return nextOwner ? { ...rest, owner: nextOwner } : (rest as Income);
    }));
    try {
      await updateIncome(id, patch);
    } catch (err) {
      setIncome(prev => prev.map(r => r.id === id ? prevRow : r));
      alert(err instanceof Error ? err.message : 'Failed to update owner');
    }
  };
  const mult = view === 'monthly' ? 1 : 12;
  const periodLabel = view === 'monthly' ? '/mo' : '/yr';
  const hasData = members.length > 0;
  const taxAndSuperMonthly = snap.salariesGrossMonthly + snap.investmentIncomeMonthly + snap.otherIncomeMonthly - snap.salariesNetMonthly;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="page-header mb-0">Cashflow</h1>
        <div className="ms-sm-auto d-flex flex-wrap gap-2">
          <div className="btn-group btn-group-sm" role="group">
            <button className={`btn ${view === 'monthly' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('monthly')}>Monthly</button>
            <button className={`btn ${view === 'annual' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('annual')}>Annual</button>
          </div>
          <ViewToggle value={mode} onChange={setMode} />
        </div>
      </div>

      <div className="mb-3">
        <PeriodFilter
          onChange={setPeriod}
          defaultPreset="last-6m"
          storageKey="period.cashflow"
        />
      </div>

      {hasData && mode === 'summary' && (
        <div className="row mb-3">
          <div className="col-md-3">
            <div className="card border-0 bg-teal text-white mb-3">
              <div className="card-body">
                <div className="text-white text-opacity-75 mb-1">Net Income {periodLabel}</div>
                <h3 className="text-white mb-0">${fmt(snap.totalIncomeMonthly * mult)}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 bg-warning text-dark mb-3">
              <div className="card-body">
                <div className="text-dark text-opacity-75 mb-1">Outflows {periodLabel}</div>
                <h3 className="text-dark mb-0">${fmt(snap.outflowsMonthly * mult)}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className={`card border-0 ${snap.surplusMonthly >= 0 ? 'bg-success' : 'bg-danger'} text-white mb-3`}>
              <div className="card-body">
                <div className="text-white text-opacity-75 mb-1">{snap.surplusMonthly >= 0 ? 'Surplus' : 'Deficit'} {periodLabel}</div>
                <h3 className="text-white mb-0">${fmt(Math.abs(snap.surplusMonthly) * mult)}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 bg-indigo text-white mb-3">
              <div className="card-body">
                <div className="text-white text-opacity-75 mb-1">Savings Rate</div>
                <h3 className="text-white mb-0">{snap.savingsRatePct.toFixed(1)}%</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'detail' && <>
      <Panel>
        <PanelHeader noButton>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span><i className="fa fa-users me-2"></i>Family Members</span>
            <button className="btn btn-sm btn-success ms-sm-auto" onClick={() => { if (showMemberForm) cancelMemberForm(); else setShowMemberForm(true); }}>
              {showMemberForm ? <><i className="fa fa-times me-1"></i>Cancel</> : <><i className="fa fa-plus me-1"></i>Add Member</>}
            </button>
          </div>
        </PanelHeader>
        <PanelBody>
          {showMemberForm && (() => {
            const salaryNum = parseFloat(memberForm.salary) || 0;
            const daysNum = parseFloat(memberForm.daysPerWeek) || 5;
            const isPartTime = memberForm.employmentType === 'part-time';
            const effective = isPartTime ? salaryNum * Math.max(0, Math.min(5, daysNum)) / 5 : salaryNum;
            return (
              <form onSubmit={submitMember} className="row g-2 mb-3 p-3 bg-light rounded">
                <div className="col-md-3">
                  <label className="form-label text-muted small mb-1">Name</label>
                  <input type="text" className="form-control" placeholder="e.g. Josh" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label text-muted small mb-1">Job / Industry</label>
                  <input type="text" className="form-control" placeholder="e.g. Software Engineer" value={memberForm.job} onChange={e => setMemberForm({ ...memberForm, job: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label text-muted small mb-1">Employment</label>
                  <select className="form-select" value={memberForm.employmentType} onChange={e => setMemberForm({ ...memberForm, employmentType: e.target.value as EmploymentType })}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                  </select>
                </div>
                {isPartTime && (
                  <div className="col-md-2">
                    <label className="form-label text-muted small mb-1">Days / week</label>
                    <input type="number" className="form-control" step="0.5" min="0.5" max="5" value={memberForm.daysPerWeek} onChange={e => setMemberForm({ ...memberForm, daysPerWeek: e.target.value })} />
                  </div>
                )}
                <div className="col-md-2">
                  <label className="form-label text-muted small mb-1">{isPartTime ? 'FTE Salary' : 'Annual Salary'}</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input type="number" className="form-control" placeholder="0" step="1" min="0" value={memberForm.salary} onChange={e => setMemberForm({ ...memberForm, salary: e.target.value })} required />
                  </div>
                  {isPartTime && salaryNum > 0 && (
                    <div className="form-text small">
                      <i className="fa fa-arrow-right me-1 text-muted"></i>
                      Effective ${effective.toLocaleString('en-AU', { maximumFractionDigits: 0 })} (at {daysNum}/5 days)
                    </div>
                  )}
                </div>
                <div className="col-md-2">
                  <label className="form-label text-muted small mb-1">Super sacrifice /yr</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input type="number" className="form-control" placeholder="0" step="1" min="0" value={memberForm.superSalarySacrifice} onChange={e => setMemberForm({ ...memberForm, superSalarySacrifice: e.target.value })} />
                  </div>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button type="submit" className="btn btn-success w-100">
                    {editingMemberId ? <><i className="fa fa-check me-1"></i>Update</> : <><i className="fa fa-plus me-1"></i>Add</>}
                  </button>
                </div>
              </form>
            );
          })()}

          {members.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa fa-users fa-3x mb-3 d-block"></i>
              <p>No family members yet. Add members with their salaries to compute cashflow, tax, and savings rate.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Job / Industry</th>
                    <th>Employment</th>
                    <th className="text-end">Salary</th>
                    <th className="text-end">Super Sac</th>
                    <th className="text-end">Taxable</th>
                    <th className="text-end">Tax + ML</th>
                    <th className="text-end">Net {periodLabel}</th>
                    <th>Marginal</th>
                    <th style={{ width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {snap.members.map(mc => {
                    const raw = members.find(m => m.id === mc.id);
                    const isPT = raw?.employmentType === 'part-time';
                    const days = raw?.daysPerWeek ?? 5;
                    const rawSalary = raw?.salary ?? mc.salary;
                    return (
                    <tr key={mc.id}>
                      <td className="fw-bold">{mc.name}</td>
                      <td className="text-muted small">{raw?.job || '—'}</td>
                      <td>
                        {isPT
                          ? <span className="badge bg-info text-dark" title={`Part-time at ${days}/5 days per week`}>Part-time {days}/5</span>
                          : <span className="badge bg-light text-dark border">Full-time</span>}
                      </td>
                      <td className="text-end">
                        ${fmt(mc.salary)}
                        {isPT && (
                          <div className="small text-muted">FTE ${fmt(rawSalary)}</div>
                        )}
                      </td>
                      <td className="text-end text-muted">{mc.superSalarySacrifice > 0 ? `$${fmt(mc.superSalarySacrifice)}` : '—'}</td>
                      <td className="text-end text-muted">
                        ${fmt(mc.taxableIncome)}
                        {(() => {
                          const parts: string[] = [];
                          if (mc.investmentIncomeAnnual > 0) parts.push(`+ inv $${fmt(mc.investmentIncomeAnnual)}`);
                          if (mc.otherIncomeAnnual > 0) parts.push(`+ other $${fmt(mc.otherIncomeAnnual)}`);
                          if (mc.deductionsAnnual > 0) parts.push(`− deduct $${fmt(mc.deductionsAnnual)}`);
                          if (mc.superSalarySacrifice > 0) parts.push(`− super $${fmt(mc.superSalarySacrifice)}`);
                          if (parts.length === 0) return null;
                          const tooltip = `Salary $${fmt(mc.salary)}${mc.superSalarySacrifice > 0 ? ` − super $${fmt(mc.superSalarySacrifice)}` : ''}${mc.investmentIncomeAnnual > 0 ? ` + inv income $${fmt(mc.investmentIncomeAnnual)}` : ''}${mc.otherIncomeAnnual > 0 ? ` + other income $${fmt(mc.otherIncomeAnnual)}` : ''}${mc.deductionsAnnual > 0 ? ` − deductions $${fmt(mc.deductionsAnnual)}` : ''} = $${fmt(mc.taxableIncome)}`;
                          return (
                            <div className="small text-muted" style={{ fontSize: '0.7rem' }} title={tooltip}>
                              {parts.join(' ')}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-end text-danger">${fmt(mc.totalTax)}</td>
                      <td className="text-end fw-bold">${fmt(view === 'monthly' ? mc.netMonthly : mc.netAnnual)}</td>
                      <td><span className="badge bg-secondary">{(mc.marginalRate * 100).toFixed(0)}%</span></td>
                      <td className="text-nowrap">
                        <button className="btn btn-xs btn-primary me-1" onClick={() => editMember(members.find(m => m.id === mc.id)!)} title="Edit">
                          <i className="fa fa-pencil-alt"></i>
                        </button>
                        <button className="btn btn-xs btn-danger" onClick={() => removeMember(mc.id)} title="Delete">
                          <i className="fa fa-times"></i>
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader noButton>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span><i className="fa fa-circle-dollar-to-slot me-2"></i>Other Income</span>
            <button className="btn btn-sm btn-success ms-sm-auto" onClick={() => { if (showIncomeForm) cancelIncomeForm(); else setShowIncomeForm(true); }}>
              {showIncomeForm ? <><i className="fa fa-times me-1"></i>Cancel</> : <><i className="fa fa-plus me-1"></i>Add Income</>}
            </button>
          </div>
        </PanelHeader>
        <PanelBody>
          {showIncomeForm && (
            <form onSubmit={submitIncome} className="row g-2 mb-3 p-3 bg-light rounded">
              <div className="col-md-2">
                <label className="form-label text-muted small mb-1">Type</label>
                <select className="form-select" value={incomeForm.type} onChange={e => setIncomeForm({ ...incomeForm, type: e.target.value as IncomeSourceType })}>
                  {INCOME_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Description</label>
                <input type="text" className="form-control" placeholder="e.g. VAS dividends" value={incomeForm.description} onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })} required />
              </div>
              <div className="col-md-2">
                <label className="form-label text-muted small mb-1">Amount</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input type="number" className="form-control" placeholder="0" step="0.01" min="0" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} required />
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label text-muted small mb-1">Cadence</label>
                <select className="form-select" value={incomeForm.cadence} onChange={e => setIncomeForm({ ...incomeForm, cadence: e.target.value as IncomeCadence })}>
                  {CADENCES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label text-muted small mb-1">Owner</label>
                <select className="form-select" value={incomeForm.owner} onChange={e => setIncomeForm({ ...incomeForm, owner: e.target.value })}>
                  <option value="">— Shared —</option>
                  {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  <option value="Joint">Joint</option>
                </select>
              </div>
              <div className="col-md-1 d-flex align-items-end">
                <button type="submit" className="btn btn-success w-100">
                  <i className={`fa ${editingIncomeId ? 'fa-check' : 'fa-plus'}`}></i>
                </button>
              </div>
            </form>
          )}

          {incomeSources.length === 0 ? (
            <div className="text-muted small">No other income sources. Add dividends, interest, or side income to include them in your cashflow.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Owner</th>
                    <th className="text-end">Amount</th>
                    <th>Cadence</th>
                    <th className="text-end">Per Month</th>
                    <th style={{ width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {incomeSources.map(src => {
                    const meta = INCOME_TYPES.find(t => t.value === src.type);
                    const monthly = src.cadence === 'monthly' ? src.amount : src.cadence === 'annual' ? src.amount / 12 : src.cadence === 'weekly' ? (src.amount * 52) / 12 : (src.amount * 26) / 12;
                    return (
                      <tr key={src.id}>
                        <td><i className={`fa ${meta?.icon || 'fa-circle'} me-2 text-muted`}></i>{meta?.label}</td>
                        <td>{src.description}</td>
                        <td className="text-muted small">{src.owner || 'Shared'}</td>
                        <td className="text-end">${fmt(src.amount)}</td>
                        <td className="small text-muted">{src.cadence}</td>
                        <td className="text-end fw-bold">${fmt(monthly)}</td>
                        <td className="text-nowrap">
                          <button className="btn btn-xs btn-primary me-1" onClick={() => editIncome(src)} title="Edit">
                            <i className="fa fa-pencil-alt"></i>
                          </button>
                          <button className="btn btn-xs btn-danger" onClick={() => removeIncome(src.id)} title="Delete">
                            <i className="fa fa-times"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredIncome.length > 0 && (() => {
            const byType = filteredIncome.reduce((acc, row) => {
              if (!acc[row.type]) acc[row.type] = [];
              acc[row.type].push(row);
              return acc;
            }, {} as Record<string, Income[]>);
            const grandTotal = filteredIncome.reduce((s, r) => s + r.amount, 0);
            const visible = INCOME_TX_TYPE_ORDER.filter(t => byType[t]?.length);
            return (
              <div className="mt-4 pt-3 border-top">
                {visible.map(type => {
                  const rows = byType[type];
                  const total = rows.reduce((s, r) => s + r.amount, 0);
                  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                  const isExpanded = expandedIncomeTypes.has(type);
                  const excludedFromCalc = type === 'Salary' || type === 'Rental';
                  const color = INCOME_TX_COLORS[type];
                  return (
                    <div key={type} className="mb-2">
                      <div
                        className="d-flex align-items-center p-2 rounded"
                        style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'var(--bs-light)' : 'transparent' }}
                        onClick={() => toggleIncomeType(type)}
                      >
                        <i className={`fa fa-chevron-${isExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '12px', fontSize: '0.7rem' }}></i>
                        <i className={`fa ${INCOME_TX_ICONS[type]} me-2`} style={{ color }}></i>
                        <span className="fw-bold flex-grow-1">{type}</span>
                        {excludedFromCalc && (
                          <span className="badge bg-warning text-dark me-2 small" title="Not summed into Cashflow totals — the definitional salary / property rental above is the source of truth.">not summed</span>
                        )}
                        <span className="badge bg-secondary me-2">{rows.length}</span>
                        <span className="fw-bold me-2">${fmt(total)}</span>
                        <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                      </div>
                      {isExpanded && (
                        <div className="ms-4 mt-1 mb-2 table-responsive">
                          <table className="table table-sm table-hover mb-0">
                            <thead>
                              <tr>
                                <th style={{ width: '110px' }}>Date</th>
                                <th>Description</th>
                                <th>Owner</th>
                                <th className="text-end" style={{ width: '120px' }}>Amount</th>
                                <th style={{ width: '80px' }}>FY</th>
                                <th style={{ width: '40px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(row => {
                                const knownOwner = !row.owner
                                  || row.owner === 'Joint'
                                  || members.some(m => m.name.toLowerCase() === row.owner!.toLowerCase());
                                return (
                                <tr key={row.id}>
                                  <td className="small">{new Date(row.date).toLocaleDateString('en-AU')}</td>
                                  <td className="small">{row.description}</td>
                                  <td>
                                    <select
                                      className={`form-select form-select-sm ${!knownOwner ? 'border-warning' : ''}`}
                                      style={{ fontSize: '0.75rem', paddingTop: '0.15rem', paddingBottom: '0.15rem', minWidth: '110px' }}
                                      value={row.owner || ''}
                                      onChange={e => reassignIncomeOwner(row.id, e.target.value)}
                                      title={!knownOwner ? `"${row.owner}" doesn't match any family member — not attributed to anyone's Taxable.` : undefined}
                                    >
                                      <option value="">— Shared —</option>
                                      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                      <option value="Joint">Joint</option>
                                      {!knownOwner && row.owner && <option value={row.owner}>{row.owner} (unmatched)</option>}
                                    </select>
                                  </td>
                                  <td className="text-end small">${fmt(row.amount)}</td>
                                  <td className="small text-muted">{row.financialYear}</td>
                                  <td>
                                    <button className="btn btn-xs btn-outline-danger" onClick={() => removeIncomeRow(row.id)} title="Delete">
                                      <i className="fa fa-times"></i>
                                    </button>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {income.length > 0 && filteredIncome.length === 0 && anyFilterActive && (
            <div className="mt-3 text-muted small text-center py-3">
              <i className="fa fa-filter-circle-xmark me-2"></i>
              No uploaded income transactions match the current filters.
            </div>
          )}
        </PanelBody>
      </Panel>

      {hasData && (
        <div className="row">
          <div className="col-xl-6">
            <Panel>
              <PanelHeader noButton><i className="fa fa-arrow-trend-up me-2"></i>Income Breakdown ({view})</PanelHeader>
              <PanelBody>
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr>
                      <td><i className="fa fa-briefcase me-2 text-muted"></i>Salaries (gross)</td>
                      <td className="text-end">${fmt(snap.salariesGrossMonthly * mult)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted"><i className="fa fa-minus me-2 small"></i>Tax + Medicare Levy + Super Sacrifice</td>
                      <td className="text-end text-danger">−${fmt(taxAndSuperMonthly * mult)}</td>
                    </tr>
                    <tr>
                      <td><i className="fa fa-house me-2 text-muted"></i>Net rental (after interest & linked expenses)</td>
                      <td className="text-end">${fmt(snap.investmentIncomeMonthly * mult)}</td>
                    </tr>
                    <tr>
                      <td><i className="fa fa-circle-dollar-to-slot me-2 text-muted"></i>Other income</td>
                      <td className="text-end">${fmt(snap.otherIncomeMonthly * mult)}</td>
                    </tr>
                    <tr className="table-active fw-bold">
                      <td>Net Income {periodLabel}</td>
                      <td className="text-end">${fmt(snap.totalIncomeMonthly * mult)}</td>
                    </tr>
                  </tbody>
                </table>
              </PanelBody>
            </Panel>
          </div>
          <div className="col-xl-6">
            <Panel>
              <PanelHeader noButton><i className="fa fa-arrow-trend-down me-2"></i>Outflow Breakdown ({view})</PanelHeader>
              <PanelBody>
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr>
                      <td><i className="fa fa-building-columns me-2 text-muted"></i>Loan repayments</td>
                      <td className="text-end">${fmt(snap.loanRepaymentsMonthly * mult)}</td>
                    </tr>
                    {TYPE_ORDER.map(t => {
                      const amt = snap.expensesByTypeMonthly[t] || 0;
                      if (amt === 0) return null;
                      return (
                        <tr key={t}>
                          <td>
                            <span className="rounded-circle me-2 d-inline-block" style={{ width: '10px', height: '10px', backgroundColor: TYPE_META[t].color }}></span>
                            {TYPE_META[t].label}
                          </td>
                          <td className="text-end">${fmt(amt * mult)}</td>
                        </tr>
                      );
                    })}
                    <tr className="table-active fw-bold">
                      <td>Total Outflows {periodLabel}</td>
                      <td className="text-end">${fmt(snap.outflowsMonthly * mult)}</td>
                    </tr>
                  </tbody>
                </table>
                {snap.monthsCovered < 3 && (
                  <div className="alert alert-warning py-2 small mb-0 mt-2">
                    <i className="fa fa-triangle-exclamation me-1"></i>
                    Only {snap.monthsCovered} month{snap.monthsCovered === 1 ? '' : 's'} of expense data — outflow figures may not be representative yet.
                  </div>
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}
      </>}

      {hasData && mode === 'summary' && (
        <Panel>
          <PanelHeader noButton><i className="fa fa-scale-balanced me-2"></i>Net Position ({view})</PanelHeader>
          <PanelBody>
            <div className="d-flex rounded overflow-hidden mb-3" style={{ height: '22px' }}>
              {(() => {
                const totalIn = Math.max(snap.totalIncomeMonthly, 1);
                const outPct = Math.min(100, (snap.outflowsMonthly / totalIn) * 100);
                const surplusPct = Math.max(0, 100 - outPct);
                return (
                  <>
                    <div title={`Outflows: $${fmt(snap.outflowsMonthly * mult)}`} style={{ width: `${outPct}%`, backgroundColor: '#fd7e14' }}></div>
                    <div title={`Surplus: $${fmt(snap.surplusMonthly * mult)}`} style={{ width: `${surplusPct}%`, backgroundColor: snap.surplusMonthly >= 0 ? '#198754' : '#dc3545' }}></div>
                  </>
                );
              })()}
            </div>
            <div className="row text-center">
              <div className="col-md-4">
                <div className="text-muted small">Income {periodLabel}</div>
                <div className="fs-4 fw-bold text-teal">${fmt(snap.totalIncomeMonthly * mult)}</div>
              </div>
              <div className="col-md-4">
                <div className="text-muted small">Outflows {periodLabel}</div>
                <div className="fs-4 fw-bold text-warning">${fmt(snap.outflowsMonthly * mult)}</div>
              </div>
              <div className="col-md-4">
                <div className="text-muted small">{snap.surplusMonthly >= 0 ? 'Surplus' : 'Deficit'} {periodLabel}</div>
                <div className={`fs-4 fw-bold ${snap.surplusMonthly >= 0 ? 'text-success' : 'text-danger'}`}>${fmt(Math.abs(snap.surplusMonthly) * mult)}</div>
              </div>
            </div>
            <p className="text-muted small mb-0 mt-3 text-center">
              Based on {snap.monthsCovered} month{snap.monthsCovered === 1 ? '' : 's'} of expense data, current salaries, super contributions, rental income, and other income sources. Used as a guide for the Expenses Doctor.
            </p>
          </PanelBody>
        </Panel>
      )}
    </>
  );
}
