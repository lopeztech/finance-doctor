'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, Investment, FamilyMember } from '@/lib/types';
import { fetchDashboardTips, type DashboardTip } from '@/lib/functions-client';
import { listExpenses } from '@/lib/expenses-repo';
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
import { monthKey } from '@/lib/budgets-calc';
import { FinancialYearFilter } from '@/components/period-filter';
import { getFinancialYear, type Period } from '@/lib/period';
import { currentFinancialYear, maybeEmitEofyReminder } from '@/lib/tax-deadline';
import { usePreferences } from '@/lib/use-preferences';
import BudgetsWidget from '@/components/budgets-widget';

const CATEGORY_ICONS: Record<string, string> = {
  'Work from Home': 'fa-house-laptop',
  'Vehicle & Travel': 'fa-car',
  'Clothing & Laundry': 'fa-shirt',
  'Self-Education': 'fa-graduation-cap',
  'Tools & Equipment': 'fa-tools',
  'Professional Memberships': 'fa-id-card',
  'Phone & Internet': 'fa-mobile-alt',
  'Donations': 'fa-hand-holding-heart',
  'Investment Expenses': 'fa-piggy-bank',
  'Other Deductions': 'fa-receipt',
};

const TYPE_ICONS: Record<string, string> = {
  'Australian Shares': 'fa-chart-bar',
  'International Shares': 'fa-globe',
  'ETFs': 'fa-layer-group',
  'Bonds': 'fa-file-contract',
  'Property': 'fa-building',
  'Cryptocurrency': 'fa-bitcoin-sign',
  'Cash / Term Deposit': 'fa-university',
  'Superannuation': 'fa-piggy-bank',
  'Other': 'fa-wallet',
};

const TYPE_COLORS: Record<string, string> = {
  'Australian Shares': 'bg-primary',
  'International Shares': 'bg-info',
  'ETFs': 'bg-teal',
  'Bonds': 'bg-warning',
  'Property': 'bg-danger',
  'Cryptocurrency': 'bg-orange',
  'Cash / Term Deposit': 'bg-success',
  'Superannuation': 'bg-indigo',
  'Other': 'bg-secondary',
};

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
  const { prefs, ready: prefsReady } = usePreferences();
  const initialFy = prefs.defaults.defaultFinancialYear === 'current'
    ? currentFinancialYear()
    : prefs.defaults.defaultFinancialYear;
  const [period, setPeriod] = useState<Period>(null);
  const financialYear = period ? getFinancialYear(period.fromYmd) : initialFy;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<DashboardTip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);
  const [excludeSuper, setExcludeSuper] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [form, setForm] = useState<LiabilityFormState>(EMPTY_LIABILITY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setExpenses(await listExpenses(financialYear));
  }, [financialYear]);

  useEffect(() => {
    Promise.all([
      fetchExpenses(),
      listInvestments().then(setInvestments).catch(() => setInvestments([])),
      listFamilyMembers().then(setFamilyMembers).catch(() => setFamilyMembers([])),
      listLiabilities().then(setLiabilities).catch(() => setLiabilities([])),
      listNetWorthHistory().then(setHistory).catch(() => setHistory([])),
    ]).then(() => setLoading(false));

    fetchDashboardTips()
      .then(result => { setTips(result); setTipsLoading(false); })
      .catch(() => setTipsLoading(false));

    maybeEmitEofyReminder().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) fetchExpenses();
  }, [financialYear, fetchExpenses, loading]);

  const totalDeductions = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([a], [b]) => a.localeCompare(b));

  const totalPortfolio = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const totalGainLoss = investments.reduce((sum, i) => {
    return sum + ((i as any).liability ? i.currentValue - (i as any).liability : i.currentValue - i.costBasis);
  }, 0);
  const totalReturnPct = totalCost > 0 ? ((totalGainLoss / totalCost) * 100) : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue;
    return acc;
  }, {} as Record<string, number>);
  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

  const typeCount = Object.keys(allocationByType).length;
  const maxPct = totalPortfolio > 0
    ? Math.max(...Object.values(allocationByType).map(v => (v / totalPortfolio) * 100))
    : 0;

  const getInvestmentHealth = () => {
    if (investments.length === 0) return null;
    let score = 0;
    if (typeCount >= 4) score += 2; else if (typeCount >= 2) score += 1;
    if (maxPct < 40) score += 2; else if (maxPct < 60) score += 1;
    if (allocationByType['Superannuation']) score += 1;
    if (score >= 4) return { label: 'Healthy', color: 'success', icon: 'fa-heart' };
    if (score >= 2) return { label: 'Fair', color: 'warning', icon: 'fa-heart-crack' };
    return { label: 'Needs Attention', color: 'danger', icon: 'fa-heart-pulse' };
  };

  const getTaxHealth = () => {
    if (expenses.length === 0) return null;
    const cats = Object.keys(categoryTotals).length;
    if (cats >= 7) return { label: 'Healthy', color: 'success', icon: 'fa-heart' };
    if (cats >= 4) return { label: 'Fair', color: 'warning', icon: 'fa-heart-crack' };
    return { label: 'Needs Attention', color: 'danger', icon: 'fa-heart-pulse' };
  };

  function calculateTax(taxableIncome: number): number {
    if (taxableIncome <= 18200) return 0;
    if (taxableIncome <= 45000) return (taxableIncome - 18200) * 0.16;
    if (taxableIncome <= 135000) return 4288 + (taxableIncome - 45000) * 0.30;
    if (taxableIncome <= 190000) return 31288 + (taxableIncome - 135000) * 0.37;
    return 51638 + (taxableIncome - 190000) * 0.45;
  }

  function calculateMedicareLevy(taxableIncome: number): number {
    if (taxableIncome <= 26000) return 0;
    if (taxableIncome <= 32500) return (taxableIncome - 26000) * 0.10;
    return taxableIncome * 0.02;
  }

  const taxEstimates = familyMembers.map(member => {
    const grossIncome = member.salary;
    const deductions = totalDeductions / (familyMembers.length || 1);
    const taxableIncome = Math.max(0, grossIncome - deductions);
    const incomeTax = calculateTax(taxableIncome);
    const medicare = calculateMedicareLevy(taxableIncome);
    const totalTax = incomeTax + medicare;
    const paygWithheld = calculateTax(grossIncome) + calculateMedicareLevy(grossIncome);
    const estimatedRefund = paygWithheld - totalTax;
    const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
    return {
      name: member.name,
      grossIncome, deductions, taxableIncome, incomeTax, medicare, totalTax,
      paygWithheld, estimatedRefund, effectiveRate,
    };
  });

  const totalFamilyRefund = taxEstimates.reduce((sum, e) => sum + e.estimatedRefund, 0);
  const taxHealth = getTaxHealth();
  const investHealth = getInvestmentHealth();

  const summary = useMemo(
    () => computeNetWorth(investments, liabilities, { excludeSuper }),
    [investments, liabilities, excludeSuper],
  );

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
  const monthDeltaClasses = deltaBadge(monthDelta.delta);
  const yearDeltaClasses = deltaBadge(yearDelta.delta);

  const memberLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const fm of familyMembers) m.set(fm.id, fm.name);
    return m;
  }, [familyMembers]);

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

  const resetForm = () => { setForm(EMPTY_LIABILITY_FORM); setEditingId(null); setFormError(null); };

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

  const handleLiabilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const balance = parseFloat(form.currentBalance);
    const original = parseFloat(form.originalAmount) || balance;
    if (!form.name.trim()) { setFormError('Give the liability a name.'); return; }
    if (!Number.isFinite(balance) || balance < 0) { setFormError('Balance must be 0 or greater.'); return; }
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
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleLiabilityDelete = async (id: string) => {
    if (!confirm('Delete this liability?')) return;
    await deleteLiability(id);
    const fresh = await listLiabilities();
    setLiabilities(fresh);
    if (editingId === id) resetForm();
  };

  if (loading) {
    return (
      <>
        <h1 className="page-header">Net Worth</h1>
        <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      </>
    );
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="page-header mb-0">Net Worth</h1>
      </div>

      <div className="mb-3">
        {prefsReady && (
          <FinancialYearFilter
            onChange={setPeriod}
            availableFys={[]}
            defaultFy={prefs.defaults.defaultFinancialYear}
            storageKey="period.networth"
          />
        )}
      </div>

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

      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="card border-0 bg-teal text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Portfolio Value</div>
              <h3 className="text-white mb-0">${totalPortfolio.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className={`card border-0 ${totalGainLoss >= 0 ? 'bg-success' : 'bg-danger'} text-white mb-3`}>
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Total Gain / Loss</div>
              <h3 className="text-white mb-0">
                {totalGainLoss >= 0 ? '+' : ''}{totalGainLoss.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                <small className="ms-2 fs-6">({totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}%)</small>
              </h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-dark text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Tax Deductions YTD</div>
              <h3 className="text-white mb-0">${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-indigo text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Expense Categories</div>
              <h3 className="text-white mb-0">{Object.keys(categoryTotals).length} / 10</h3>
            </div>
          </div>
        </div>
      </div>

      <BudgetsWidget />

      {(tips.length > 0 || tipsLoading) && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-stethoscope me-2"></i>Dr Finance Says
              <span className="badge bg-teal ms-auto">Daily Tips</span>
            </div>
          </PanelHeader>
          <PanelBody>
            {tipsLoading ? (
              <div className="text-center py-3 text-muted">
                <i className="fa fa-spinner fa-spin me-2"></i>Dr Finance is reviewing your finances...
              </div>
            ) : (
              <div className="row">
                {tips.map((tip, i) => {
                  const colors = { tax: 'teal', investment: 'indigo', strategy: 'warning' };
                  const labels = { tax: 'Tax', investment: 'Portfolio', strategy: 'Strategy' };
                  const color = colors[tip.type] || 'secondary';
                  return (
                    <div key={i} className="col-md-4 mb-2 mb-md-0">
                      <div className={`d-flex align-items-start p-3 rounded bg-light h-100`}>
                        <div className={`text-${color} me-3 mt-1`}>
                          <i className={`fa ${tip.icon} fa-lg`}></i>
                        </div>
                        <div>
                          <span className={`badge bg-${color} mb-1`} style={{ fontSize: '0.65rem' }}>{labels[tip.type] || tip.type}</span>
                          <p className="mb-0 small">{tip.tip}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      {taxEstimates.length > 0 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-calculator me-2"></i>Tax Estimate — FY {financialYear}
              {totalFamilyRefund > 0 && (
                <span className="badge bg-success ms-auto">
                  <i className="fa fa-arrow-down me-1"></i>Estimated refund: ${totalFamilyRefund.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              )}
              {totalFamilyRefund < 0 && (
                <span className="badge bg-danger ms-auto">
                  <i className="fa fa-arrow-up me-1"></i>Estimated owing: ${Math.abs(totalFamilyRefund).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </PanelHeader>
          <PanelBody>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="text-end">Gross Income</th>
                    <th className="text-end">Deductions</th>
                    <th className="text-end">Taxable Income</th>
                    <th className="text-end">Income Tax</th>
                    <th className="text-end">Medicare</th>
                    <th className="text-end">PAYG Withheld</th>
                    <th className="text-end">Est. Refund</th>
                    <th className="text-end">Effective Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {taxEstimates.map((est, i) => (
                    <tr key={i}>
                      <td className="fw-bold">{est.name}</td>
                      <td className="text-end">${est.grossIncome.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-teal">${est.deductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${est.taxableIncome.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${est.incomeTax.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${est.medicare.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-muted">${est.paygWithheld.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className={`text-end fw-bold ${est.estimatedRefund >= 0 ? 'text-success' : 'text-danger'}`}>
                        {est.estimatedRefund >= 0 ? '+' : ''}{est.estimatedRefund.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-end text-muted">{est.effectiveRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                {taxEstimates.length > 1 && (
                  <tfoot>
                    <tr className="fw-bold">
                      <td>Total</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.grossIncome, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-teal">${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.taxableIncome, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.incomeTax, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.medicare, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-muted">${taxEstimates.reduce((s, e) => s + e.paygWithheld, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className={`text-end ${totalFamilyRefund >= 0 ? 'text-success' : 'text-danger'}`}>
                        {totalFamilyRefund >= 0 ? '+' : ''}{totalFamilyRefund.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="text-muted small mt-2 mb-0">
              <i className="fa fa-info-circle me-1"></i>
              Estimate based on FY {financialYear} tax rates. PAYG assumes standard withholding on gross salary. Deductions split evenly across members. This is not tax advice — consult your accountant.
            </p>
          </PanelBody>
        </Panel>
      )}

      {familyMembers.length === 0 && expenses.length > 0 && (
        <div className="alert alert-info mb-3">
          <i className="fa fa-info-circle me-2"></i>
          <Link href="/cashflow" className="alert-link">Add family members</Link> with their salaries to see a personalised tax estimate.
        </div>
      )}

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
                            <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => handleLiabilityDelete(l.id)}>Delete</button>
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
              <form onSubmit={handleLiabilitySubmit}>
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
                      {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                {formError && <div className="text-danger small mb-2">{formError}</div>}
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

      <div className="row">
        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-chart-line me-2"></i>Investment Health
                {investHealth && (
                  <span className={`badge bg-${investHealth.color} ms-auto`}>
                    <i className={`fa ${investHealth.icon} me-1`}></i>{investHealth.label}
                  </span>
                )}
              </div>
            </PanelHeader>
            <PanelBody>
              {investments.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-chart-line fa-2x mb-2 d-block"></i>
                  <p className="mb-2">No investments tracked yet</p>
                  <Link href="/investments" className="btn btn-sm btn-teal">Add Investments</Link>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    {sortedAllocations.map(([type, value]) => {
                      const pct = totalPortfolio > 0 ? (value / totalPortfolio) * 100 : 0;
                      return (
                        <div key={type} className="mb-2">
                          <div className="d-flex align-items-center mb-1">
                            <i className={`fa ${TYPE_ICONS[type] || 'fa-wallet'} me-2 text-muted`} style={{ fontSize: '0.8rem', width: '16px' }}></i>
                            <span className="flex-grow-1 small">{type}</span>
                            <span className="small fw-bold">${value.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</span>
                            <span className="small text-muted ms-2" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="progress" style={{ height: '3px' }}>
                            <div className={`progress-bar ${TYPE_COLORS[type] || 'bg-secondary'}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Link href="/investments" className="btn btn-sm btn-outline-primary">View Details <i className="fa fa-arrow-right ms-1"></i></Link>
                </>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-file-invoice-dollar me-2"></i>Tax Health
                {taxHealth && (
                  <span className={`badge bg-${taxHealth.color} ms-auto`}>
                    <i className={`fa ${taxHealth.icon} me-1`}></i>{taxHealth.label}
                  </span>
                )}
              </div>
            </PanelHeader>
            <PanelBody>
              {expenses.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-file-invoice-dollar fa-2x mb-2 d-block"></i>
                  <p className="mb-2">No expenses tracked for FY {financialYear}</p>
                  <Link href="/tax" className="btn btn-sm btn-teal">Add Expenses</Link>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    {sortedCategories.map(([category, total]) => (
                      <div key={category} className="mb-2">
                        <div className="d-flex align-items-center mb-1">
                          <i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'} me-2 text-muted`} style={{ fontSize: '0.8rem', width: '16px' }}></i>
                          <span className="flex-grow-1 small">{category}</span>
                          <span className="small fw-bold">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="progress" style={{ height: '3px' }}>
                          <div className="progress-bar bg-teal" style={{ width: `${(total / totalDeductions) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/tax" className="btn btn-sm btn-outline-primary">View Details <i className="fa fa-arrow-right ms-1"></i></Link>
                </>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      {history.length > 0 && (
        <Panel className="mb-3 mt-3">
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
  );
}
