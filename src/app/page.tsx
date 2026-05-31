'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { Expense, Investment, FamilyMember } from '@/lib/types';
import { fetchDashboardTips, adviceChatGet, type DashboardTip } from '@/lib/functions-client';
import { assessmentAge, type DoctorSummaryItem } from '@/lib/doctor-summary';
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
  LIABILITY_KIND_LABEL,
  type Liability,
  type LiabilityKind,
  type NetWorthSnapshot,
} from '@/lib/networth-types';
import { formatCurrency } from '@/lib/format';
import { monthKey } from '@/lib/budgets-calc';
import { getFinancialYear, type Period } from '@/lib/period';
import { currentFinancialYear, maybeEmitEofyReminder } from '@/lib/tax-deadline';
import { usePreferences } from '@/lib/use-preferences';

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

const DEDUCTION_CATEGORIES = Object.keys(CATEGORY_ICONS).filter(c => c !== 'Other Deductions');

const ALLOC_COLORS: Record<string, string> = {
  'Superannuation':       'var(--fd-indigo)',
  'Australian Shares':    'var(--fd-blue)',
  'International Shares': 'var(--fd-cyan)',
  'ETFs':                 'var(--fd-teal)',
  'Cash / Term Deposit':  'var(--fd-green)',
  'Bonds':                'var(--fd-amber)',
  'Cryptocurrency':       'var(--fd-red)',
  'Property':             'var(--fd-red)',
  'Other':                'var(--ink-3)',
};

const KIND_OPTIONS: LiabilityKind[] = [
  'mortgage', 'personal-loan', 'car-loan', 'student-loan', 'credit-card', 'other',
];

interface LiabilityFormState {
  name: string; kind: LiabilityKind; owner: string;
  currentBalance: string; originalAmount: string;
  interestRate: string; minMonthlyPayment: string;
}
const EMPTY_LIABILITY_FORM: LiabilityFormState = {
  name: '', kind: 'mortgage', owner: '',
  currentBalance: '', originalAmount: '', interestRate: '', minMonthlyPayment: '',
};

interface AdvisorAction {
  pillar: 'Financial' | 'Tax' | 'Cashflow';
  priority: 'High' | 'Medium' | 'Low';
  title: string; detail: string; impact: string;
  href?: string; action?: 'save-snapshot'; icon: string; color: string;
}

export default function NetWorthPage() {
  const { prefs, ready: prefsReady } = usePreferences();
  const initialFy = prefs.defaults.defaultFinancialYear === 'current'
    ? currentFinancialYear() : prefs.defaults.defaultFinancialYear;
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
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [form, setForm] = useState<LiabilityFormState>(EMPTY_LIABILITY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [doctorSummaries, setDoctorSummaries] = useState<{
    tax: DoctorSummaryItem[]; cashflow: DoctorSummaryItem[]; investments: DoctorSummaryItem[];
  }>({ tax: [], cashflow: [], investments: [] });
  const [selectedFyIdx, setSelectedFyIdx] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2600);
  }, []);

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
      .then(r => { setTips(r); setTipsLoading(false); })
      .catch(() => setTipsLoading(false));
    Promise.all([
      adviceChatGet<DoctorSummaryItem>('tax-summary'),
      adviceChatGet<DoctorSummaryItem>('cashflow-summary'),
      adviceChatGet<DoctorSummaryItem>('investments-summary'),
    ]).then(([tax, cashflow, investments]) => setDoctorSummaries({ tax, cashflow, investments })).catch(() => {});
    maybeEmitEofyReminder().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) fetchExpenses();
  }, [financialYear, fetchExpenses, loading]);

  const totalDeductions = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {} as Record<string, number>);

  const totalPortfolio = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const totalGainLoss = investments.reduce((sum, i) =>
    sum + (i.liability ? i.currentValue - i.liability : i.currentValue - i.costBasis), 0);
  const totalReturnPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue; return acc;
  }, {} as Record<string, number>);
  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

  const typeCount = Object.keys(allocationByType).length;
  const maxPct = totalPortfolio > 0
    ? Math.max(...Object.values(allocationByType).map(v => (v / totalPortfolio) * 100)) : 0;

  function calculateTax(inc: number): number {
    if (inc <= 18200) return 0;
    if (inc <= 45000) return (inc - 18200) * 0.16;
    if (inc <= 135000) return 4288 + (inc - 45000) * 0.30;
    if (inc <= 190000) return 31288 + (inc - 135000) * 0.37;
    return 51638 + (inc - 190000) * 0.45;
  }
  function calculateMedicare(inc: number): number {
    if (inc <= 26000) return 0;
    if (inc <= 32500) return (inc - 26000) * 0.10;
    return inc * 0.02;
  }

  const taxEstimates = familyMembers.map(member => {
    const gross = member.salary;
    const ded = totalDeductions / (familyMembers.length || 1);
    const taxable = Math.max(0, gross - ded);
    const incomeTax = calculateTax(taxable);
    const medicare = calculateMedicare(taxable);
    const payg = calculateTax(gross) + calculateMedicare(gross);
    return {
      name: member.name, grossIncome: gross, deductions: ded, taxableIncome: taxable,
      incomeTax, medicare, totalTax: incomeTax + medicare,
      paygWithheld: payg, estimatedRefund: payg - (incomeTax + medicare),
      effectiveRate: gross > 0 ? ((incomeTax + medicare) / gross) * 100 : 0,
    };
  });
  const totalFamilyRefund = taxEstimates.reduce((s, e) => s + e.estimatedRefund, 0);

  const summary = useMemo(
    () => computeNetWorth(investments, liabilities, { excludeSuper }),
    [investments, liabilities, excludeSuper],
  );

  const month = monthKey(new Date());
  const prevMonthKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
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
    for (const fm of familyMembers) m.set(fm.id, fm.name);
    return m;
  }, [familyMembers]);

  const memberRows = useMemo(() => {
    return Object.entries(summary.netWorthByMember)
      .map(([key, value]) => ({
        key,
        label: key === NET_WORTH_JOINT_KEY ? 'Joint / unassigned' : (memberLookup.get(key) || key),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [summary.netWorthByMember, memberLookup]);

  const advisorActions = useMemo<AdvisorAction[]>(() => {
    const actions: AdvisorAction[] = [];
    const unassigned = investments.filter(i => !i.owner).length;
    const uncatTax = expenses.filter(e => !e.nonDeductible && e.category === 'Other Deductions').length;
    const missingCats = Math.max(0, DEDUCTION_CATEGORIES.length - Object.keys(categoryTotals).length);
    const hasSnap = history.some(h => h.id === month);

    if (!familyMembers.length)
      actions.push({ pillar: 'Cashflow', priority: 'High', title: 'Add household income',
        detail: 'Salary data powers cashflow, tax estimates, and more precise advice.',
        impact: 'Unlocks after-tax income, savings rate, and member-level tax position',
        href: '/cashflow', icon: 'fa-users', color: 'teal' });

    if (uncatTax > 0)
      actions.push({ pillar: 'Tax', priority: 'High', title: 'Review uncategorised deductions',
        detail: `${uncatTax} expense${uncatTax === 1 ? '' : 's'} still sit in Other Deductions.`,
        impact: 'Improves deduction accuracy before EOFY',
        href: '/tax', icon: 'fa-file-circle-question', color: 'warning' });

    if (unassigned > 0)
      actions.push({ pillar: 'Financial', priority: 'Medium', title: 'Assign investment ownership',
        detail: `${unassigned} holding${unassigned === 1 ? '' : 's'} are missing an owner.`,
        impact: 'Improves CGT and family tax analysis',
        href: '/investments', icon: 'fa-user-tag', color: 'indigo' });

    if (summary.netWorth !== 0 && !hasSnap)
      actions.push({ pillar: 'Financial', priority: 'Medium', title: "Save this month's net worth snapshot",
        detail: 'A snapshot gives the advisor a baseline for monthly and yearly trend checks.',
        impact: 'Starts trend tracking from this month',
        action: 'save-snapshot', icon: 'fa-camera', color: 'primary' });

    if (investments.length > 0 && maxPct >= 60)
      actions.push({ pillar: 'Financial', priority: 'Medium', title: 'Review concentration risk',
        detail: `Largest asset class is ${maxPct.toFixed(0)}% of portfolio.`,
        impact: 'Highlights diversification and rebalancing risk',
        href: '/investments', icon: 'fa-chart-pie', color: 'danger' });

    if (expenses.length > 0 && missingCats >= 4)
      actions.push({ pillar: 'Tax', priority: 'Low', title: 'Check missing deduction categories',
        detail: `${missingCats} standard categor${missingCats === 1 ? 'y is' : 'ies are'} unused this FY.`,
        impact: 'May reveal missed work, education, donation, or investment claims',
        href: '/tax', icon: 'fa-magnifying-glass-dollar', color: 'teal' });

    for (const { key, pillar, href, color } of [
      { key: 'tax' as const, pillar: 'Tax' as const, href: '/tax', color: 'warning' },
      { key: 'cashflow' as const, pillar: 'Cashflow' as const, href: '/cashflow', color: 'teal' },
      { key: 'investments' as const, pillar: 'Financial' as const, href: '/investments', color: 'indigo' },
    ]) {
      const item = doctorSummaries[key][0];
      if (item) {
        const age = item.savedAt ? assessmentAge(item.savedAt) : null;
        const stale = age?.stale ?? false;
        actions.push({ pillar, priority: stale ? 'Medium' : 'Low', title: item.title,
          detail: stale ? `Assessment is ${age!.days} days old — consider a fresh run.` : item.detail,
          impact: age ? `From last ${pillar} Doctor assessment · ${age.label}` : `From last ${pillar} Doctor assessment`,
          href, icon: 'fa-stethoscope', color: stale ? 'secondary' : color });
      }
    }

    if (actions.length === 0)
      actions.push({ pillar: 'Financial', priority: 'Low', title: 'Run the advisor checkups',
        detail: 'Core setup looks healthy. Refresh the Tax, Cashflow, and Investment assessments.',
        impact: 'Keeps advice current as new data arrives',
        href: '/cashflow', icon: 'fa-stethoscope', color: 'success' });

    const rank: Record<AdvisorAction['priority'], number> = { High: 0, Medium: 1, Low: 2 };
    return actions.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 5);
  }, [investments, expenses, categoryTotals, history, month, familyMembers.length, summary.netWorth, maxPct, doctorSummaries]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      await saveNetWorthSnapshot(snapshotFromSummary(month, summary));
      setHistory(await listNetWorthHistory());
      showToast(`Snapshot saved for ${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`);
    } finally { setSnapshotting(false); }
  };

  const resetForm = () => { setForm(EMPTY_LIABILITY_FORM); setEditingId(null); setFormError(null); };
  const beginEditLiability = (l: Liability) => {
    setEditingId(l.id);
    setForm({ name: l.name, kind: l.kind, owner: l.owner || '',
      currentBalance: String(l.currentBalance), originalAmount: String(l.originalAmount),
      interestRate: l.interestRate ? String(l.interestRate) : '',
      minMonthlyPayment: l.minMonthlyPayment ? String(l.minMonthlyPayment) : '' });
  };
  const handleLiabilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null);
    const balance = parseFloat(form.currentBalance);
    const original = parseFloat(form.originalAmount) || balance;
    if (!form.name.trim()) { setFormError('Give the liability a name.'); return; }
    if (!Number.isFinite(balance) || balance < 0) { setFormError('Balance must be 0 or greater.'); return; }
    setSaving(true);
    try {
      const data: Omit<Liability, 'id'> = {
        name: form.name.trim(), kind: form.kind, owner: form.owner || undefined,
        currentBalance: balance, originalAmount: original,
        ...(form.interestRate ? { interestRate: parseFloat(form.interestRate) } : {}),
        ...(form.minMonthlyPayment ? { minMonthlyPayment: parseFloat(form.minMonthlyPayment) } : {}),
      };
      if (editingId) await updateLiability(editingId, data);
      else { const added = await addLiability(data); setLiabilities(prev => [...prev, added]); }
      setLiabilities(await listLiabilities());
      resetForm();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Save failed.'); }
    finally { setSaving(false); }
  };
  const handleLiabilityDelete = async (id: string) => {
    if (!confirm('Delete this liability?')) return;
    await deleteLiability(id);
    setLiabilities(await listLiabilities());
    if (editingId === id) resetForm();
  };

  // Sparkline from net-worth history
  const sparkSvg = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.id.localeCompare(b.id)).slice(-7);
    if (sorted.length < 2) return null;
    const W = 480, H = 80, pad = 6;
    const vals = sorted.map(h => h.netWorth);
    const min = Math.min(...vals), max = Math.max(...vals), rng = (max - min) || 1;
    const pts = vals.map((v, i) => [
      pad + (i / (vals.length - 1)) * (W - pad * 2),
      pad + (1 - (v - min) / rng) * (H - pad * 2),
    ] as [number, number]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${W - pad} ${H - pad} L${pad} ${H - pad} Z`;
    const [lx, ly] = pts[pts.length - 1];
    return { W, H, line, area, lx, ly, first: sorted[0].id, last: sorted[sorted.length - 1].id };
  }, [history]);

  // Pill class for priority
  const priClass = (p: AdvisorAction['priority']) =>
    p === 'High' ? 'pri-high' : p === 'Medium' ? 'pri-med' : 'pri-low';

  // Pillar → tag class
  const pillarClass = (p: string) =>
    p === 'Tax' ? 't-amber' : p === 'Cashflow' ? 't-teal' : 't-indigo';

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const fyDisplay = financialYear.replace('-', '–');

  if (loading) {
    return (
      <main className="report" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <i className="fa fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--ink-3)' }}></i>
      </main>
    );
  }

  const fyOptions = ['FY 25–26', 'FY 24–25', 'FY 23–24'];

  return (
    <main className="report">
      {/* ── Report head ── */}
      <div className="report-head">
        <div className="lead">
          <div className="eyebrow">Health Assessment · Financial Advisor</div>
          <h1>Financial Advisor</h1>
          <p className="dek">
            {summary.netWorth > 0
              ? <>Your household net worth is <b>{formatCurrency(summary.netWorth, prefs)}</b>. Portfolio is {sortedAllocations.length > 0 ? 'tracking' : 'ready to start tracking'} — add liabilities, investments, and run the advisor assessments for personalised recommendations.</>
              : <>Add your investments and liabilities to see your net worth, tax position, and portfolio signals in one place.</>}
          </p>
        </div>
        <div className="meta">
          <div className="big">Financial Advisor</div>
          {today}<br />
          Financial year {fyDisplay}
          <div className="fy">
            {fyOptions.map((fy, i) => (
              <button key={fy} className={i === selectedFyIdx ? 'on' : ''} onClick={() => setSelectedFyIdx(i)}>
                {fy}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 01 Vitals ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">01</span>
          <h2>Vitals</h2>
          <div className="agg">
            <label className="switch">
              <input type="checkbox" checked={excludeSuper} onChange={e => setExcludeSuper(e.target.checked)} />
              <span className="tr"></span>Exclude super
            </label>
            <button className="btn btn-sm" onClick={handleSnapshot} disabled={snapshotting}>
              <i className={`fa ${snapshotting ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
              {snapshotting ? ' Saving…' : ' Save snapshot'}
            </button>
          </div>
        </div>

        <div className="vitals-band">
          <div>
            <div className="networth-label">Net worth</div>
            <div className="networth num">{formatCurrency(summary.netWorth, prefs)}</div>
            <div className="nw-deltas">
              <div className="d">
                <div className={`v num ${monthDelta.delta >= 0 ? 'pos' : 'neg'}`}>
                  <i className={`fa ${monthDelta.delta >= 0 ? 'fa-caret-up' : 'fa-caret-down'}`}></i>{' '}
                  {monthDelta.delta >= 0 ? '+' : ''}{formatCurrency(monthDelta.delta, prefs)}
                </div>
                <div className="k">vs last month{lastMonthSnap ? ` · ${monthDelta.pct > 0 ? '+' : ''}${monthDelta.pct.toFixed(1)}%` : ''}</div>
              </div>
              <div className="d">
                <div className={`v num ${yearDelta.delta >= 0 ? 'pos' : 'neg'}`}>
                  <i className={`fa ${yearDelta.delta >= 0 ? 'fa-caret-up' : 'fa-caret-down'}`}></i>{' '}
                  {yearDelta.delta >= 0 ? '+' : ''}{formatCurrency(yearDelta.delta, prefs)}
                </div>
                <div className="k">vs last year{lastYearSnap ? ` · ${yearDelta.pct > 0 ? '+' : ''}${yearDelta.pct.toFixed(1)}%` : ''}</div>
              </div>
            </div>
          </div>
          <div className="spark">
            {sparkSvg ? (
              <>
                <svg viewBox={`0 0 ${sparkSvg.W} ${sparkSvg.H}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sparkg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--fd-teal)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--fd-teal)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={sparkSvg.area} fill="url(#sparkg)" />
                  <path d={sparkSvg.line} fill="none" stroke="var(--fd-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={sparkSvg.lx} cy={sparkSvg.ly} r="4" fill="var(--fd-teal)" stroke="var(--surface)" strokeWidth="2" />
                </svg>
                <div className="cap">
                  <span>{sparkSvg.first}</span>
                  <span>{history.length}-snapshot net-worth trend</span>
                  <span>{sparkSvg.last}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', paddingTop: 20 }}>
                Save a snapshot today to start tracking the trend.
              </div>
            )}
          </div>
        </div>

        <div className="ledger">
          <div className="cell">
            <div className="k">Assets</div>
            <div className="v pos num">{formatCurrency(summary.totalAssets, prefs)}</div>
            <div className="sub">Across {Object.keys(allocationByType).length || 0} asset classes</div>
          </div>
          <div className="cell">
            <div className="k">Liabilities</div>
            <div className="v neg num">{formatCurrency(summary.totalLiabilities, prefs)}</div>
            <div className="sub">{liabilities.length} {liabilities.length === 1 ? 'loan' : 'loans'} outstanding</div>
          </div>
          <div className="cell">
            <div className="k">Super held</div>
            <div className="v num">{formatCurrency(summary.superValue, prefs)}</div>
            <div className="sub">{totalPortfolio > 0 ? `${((summary.superValue / totalPortfolio) * 100).toFixed(0)}% of portfolio` : '—'}</div>
          </div>
          <div className="cell">
            <div className="k">Est. tax refund</div>
            <div className={`v num ${totalFamilyRefund >= 0 ? 'pos' : 'neg'}`}>
              {totalFamilyRefund >= 0 ? '+' : ''}{formatCurrency(totalFamilyRefund, prefs)}
            </div>
            <div className="sub">{familyMembers.length > 0 ? `Combined, FY ${fyDisplay}` : 'Add salary data'}</div>
          </div>
        </div>
      </section>

      {/* ── 02 Prescriptions ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">02</span>
          <h2>Prescriptions</h2>
          <div className="agg">Prioritised action plan · {advisorActions.length} next step{advisorActions.length === 1 ? '' : 's'}</div>
        </div>
        <div className="rx">
          {advisorActions.map((action, idx) => {
            const inner = (
              <>
                <span className="no">{String(idx + 1).padStart(2, '0')}</span>
                <div>
                  <div className="rx-ttl">
                    {action.title}
                    <span className={`tag ${pillarClass(action.pillar)}`}>{action.pillar}</span>
                  </div>
                  <div className="det">{action.detail}</div>
                  <div className="imp"><i className="fa fa-bullseye"></i>{action.impact}</div>
                </div>
                <div className="right">
                  {action.action === 'save-snapshot' ? (
                    <button className="btn btn-fill btn-sm" onClick={handleSnapshot} disabled={snapshotting}>
                      <i className={`fa ${snapshotting ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i> Save
                    </button>
                  ) : (
                    <>
                      <span className={`pri ${priClass(action.priority)}`}>{action.priority}</span>
                      <i className="fa fa-arrow-right go"></i>
                    </>
                  )}
                </div>
              </>
            );
            if (action.action === 'save-snapshot') return <div key={action.title} className="item">{inner}</div>;
            return <Link key={action.title} href={action.href || '/'} className="item">{inner}</Link>;
          })}
        </div>
      </section>

      {/* ── 03 Portfolio ── */}
      {investments.length > 0 && (
        <section className="section">
          <div className="sec-head">
            <span className="no">03</span>
            <h2>Portfolio</h2>
            <div className="agg">
              <span className="tag t-teal"><span className="dot" style={{ background: 'var(--fd-teal)' }}></span>
                {typeCount >= 4 ? 'Healthy' : typeCount >= 2 ? 'Fair' : 'Building'}
              </span>
              {formatCurrency(totalPortfolio, prefs)}{totalReturnPct !== 0 ? ` · ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}% all-time` : ''}
            </div>
          </div>
          <div className="alloc-bar">
            {sortedAllocations.map(([type, value]) => (
              <span key={type} style={{ width: `${(value / totalPortfolio) * 100}%`, background: ALLOC_COLORS[type] || 'var(--ink-3)' }} title={`${type} · ${((value / totalPortfolio) * 100).toFixed(1)}%`} />
            ))}
          </div>
          <div className="alloc-legend">
            {sortedAllocations.map(([type, value]) => (
              <div key={type} className="lg">
                <span className="dot" style={{ background: ALLOC_COLORS[type] || 'var(--ink-3)' }}></span>
                <span className="nm">{type}</span>
                <span className="vl num">{formatCurrency(value, prefs)}</span>
                <span className="pc num">{((value / totalPortfolio) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 04 Tax Estimate ── */}
      {taxEstimates.length > 0 && (
        <section className="section">
          <div className="sec-head">
            <span className="no">{investments.length > 0 ? '04' : '03'}</span>
            <h2>Tax Estimate</h2>
            <div className="agg">
              {totalFamilyRefund >= 0
                ? <span className="tag solid t-teal"><i className="fa fa-arrow-down"></i> Refund {formatCurrency(totalFamilyRefund, prefs)}</span>
                : <span className="tag solid" style={{ background: 'var(--fd-red)' }}><i className="fa fa-arrow-up"></i> Owing {formatCurrency(Math.abs(totalFamilyRefund), prefs)}</span>}
            </div>
          </div>
          <div className="tbl-scroll">
            <table className="tbl num">
              <thead>
                <tr>
                  <th>Member</th><th>Gross</th><th>Deductions</th><th>Taxable</th>
                  <th>Income tax</th><th>Medicare</th><th>PAYG</th><th>Est. refund</th><th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {taxEstimates.map((est, i) => (
                  <tr key={i}>
                    <td className="nm">{est.name}</td>
                    <td>{formatCurrency(est.grossIncome, prefs)}</td>
                    <td className="pos">{formatCurrency(est.deductions, prefs)}</td>
                    <td>{formatCurrency(est.taxableIncome, prefs)}</td>
                    <td>{formatCurrency(est.incomeTax, prefs)}</td>
                    <td>{formatCurrency(est.medicare, prefs)}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{formatCurrency(est.paygWithheld, prefs)}</td>
                    <td className={est.estimatedRefund >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 800 }}>
                      {est.estimatedRefund >= 0 ? '+' : ''}{formatCurrency(est.estimatedRefund, prefs)}
                    </td>
                    <td style={{ color: 'var(--ink-3)' }}>{est.effectiveRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              {taxEstimates.length > 1 && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{formatCurrency(taxEstimates.reduce((s, e) => s + e.grossIncome, 0), prefs)}</td>
                    <td className="pos">{formatCurrency(totalDeductions, prefs)}</td>
                    <td>{formatCurrency(taxEstimates.reduce((s, e) => s + e.taxableIncome, 0), prefs)}</td>
                    <td>{formatCurrency(taxEstimates.reduce((s, e) => s + e.incomeTax, 0), prefs)}</td>
                    <td>{formatCurrency(taxEstimates.reduce((s, e) => s + e.medicare, 0), prefs)}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{formatCurrency(taxEstimates.reduce((s, e) => s + e.paygWithheld, 0), prefs)}</td>
                    <td className={totalFamilyRefund >= 0 ? 'pos' : 'neg'}>
                      {totalFamilyRefund >= 0 ? '+' : ''}{formatCurrency(totalFamilyRefund, prefs)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="disclaimer">
            <i className="fa fa-circle-info"></i> Estimate based on FY {financialYear} tax rates. PAYG assumes standard withholding on gross salary. Deductions split evenly across members. This is not tax advice — consult your accountant.
          </p>
        </section>
      )}

      {/* ── 05 Checkup Notes ── */}
      {(tips.length > 0 || tipsLoading) && (
        <section className="section">
          <div className="sec-head">
            <span className="no">05</span>
            <h2>Checkup Notes</h2>
            <div className="agg">Signals from Dr Finance</div>
          </div>
          {tipsLoading ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
              <i className="fa fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Dr Finance is reviewing your finances…
            </div>
          ) : (
            <div className="notes">
              {tips.map((tip, i) => {
                const colorMap: Record<string, string> = { tax: 'var(--fd-amber)', investment: 'var(--fd-indigo)', strategy: 'var(--fd-teal)' };
                const labelMap: Record<string, string> = { tax: 'Tax', investment: 'Portfolio', strategy: 'Strategy' };
                const classMap: Record<string, string> = { tax: 't-amber', investment: 't-indigo', strategy: 't-teal' };
                return (
                  <div key={i} className="note">
                    <div className="nh">
                      <span className="dot" style={{ background: colorMap[tip.type] || 'var(--ink-3)' }}></span>
                      <span className={`lbl ${classMap[tip.type] || 't-gray'}`}>{labelMap[tip.type] || tip.type}</span>
                    </div>
                    <p>{tip.tip}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── 06 Details ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">06</span>
          <h2>Details</h2>
        </div>
        <div className="two">
          {/* Deductions */}
          <div>
            <div className="subhead">Deductions by category</div>
            <div className="dlist">
              {Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).map(([cat, total]) => (
                <div key={cat} className="dl">
                  <div className="dl-top">
                    <i className={`fa ${CATEGORY_ICONS[cat] || 'fa-receipt'}`}></i>
                    <span className="nm">{cat}</span>
                    <span className="vl num">{formatCurrency(total, prefs)}</span>
                    <span className="pc num">{totalDeductions > 0 ? `${((total / totalDeductions) * 100).toFixed(0)}%` : '—'}</span>
                  </div>
                  <div className="dl-bar">
                    <span style={{ width: totalDeductions > 0 ? `${(total / totalDeductions) * 100}%` : '0%' }}></span>
                  </div>
                </div>
              ))}
              {Object.keys(categoryTotals).length === 0 && (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No deductions logged for FY {financialYear}. <Link href="/tax">Add expenses</Link></div>
              )}
            </div>
          </div>

          {/* Liabilities + members */}
          <div>
            <div className="subhead">Liabilities{liabilities.length > 0 ? ` · ${formatCurrency(summary.totalLiabilities, prefs)} owing` : ''}</div>
            {liabilities.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '13px 0' }}>No liabilities tracked yet.</div>
            ) : liabilities.map(l => (
              <div key={l.id} className="lrow">
                <span className="dot" style={{ background: 'var(--fd-red)', width: 11, height: 11 }}></span>
                <div>
                  <div className="nm">{l.name}</div>
                  <div className="sub">{LIABILITY_KIND_LABEL[l.kind]}{l.interestRate ? ` · ${l.interestRate}% p.a.` : ''}{l.owner ? ` · ${memberLookup.get(l.owner) || l.owner}` : ' · joint'}</div>
                  <div style={{ fontSize: 11.5, marginTop: 4, display: 'flex', gap: 12 }}>
                    <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-teal)', fontSize: 11.5, fontWeight: 700 }} onClick={() => beginEditLiability(l)}>Edit</button>
                    <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-red)', fontSize: 11.5, fontWeight: 700 }} onClick={() => handleLiabilityDelete(l.id)}>Delete</button>
                  </div>
                </div>
                <span className="amt neg num">{formatCurrency(l.currentBalance, prefs)}</span>
              </div>
            ))}

            <div className="subhead" style={{ marginTop: 24 }}>Net worth by member</div>
            {memberRows.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '13px 0' }}>Add investments or liabilities to see member breakdown.</div>
            ) : memberRows.map(row => (
              <div key={row.key} className="lrow">
                <div><div className="nm">{row.label}</div></div>
                <span className={`amt num ${row.value < 0 ? 'neg' : ''}`}>{formatCurrency(row.value, prefs)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Add/edit liability form */}
        <div style={{ marginTop: 28 }}>
          <div className="subhead">{editingId ? 'Edit liability' : 'Add liability'}</div>
          <form onSubmit={handleLiabilitySubmit}>
            <div className="qform" style={{ gridTemplateColumns: 'repeat(3, 1fr) auto', marginTop: 8 }}>
              <div className="fld">
                <label>Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. ANZ home loan" />
              </div>
              <div className="fld">
                <label>Kind</label>
                <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as LiabilityKind }))}>
                  {KIND_OPTIONS.map(k => <option key={k} value={k}>{LIABILITY_KIND_LABEL[k]}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Balance</label>
                <input type="number" min={0} step="0.01" value={form.currentBalance} onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} placeholder="0.00" />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-fill btn-sm" disabled={saving}>
                  <i className={`fa ${saving ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
                  {saving ? ' Saving…' : editingId ? ' Save changes' : ' Add liability'}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-sm" onClick={resetForm}>Cancel</button>
                )}
              </div>
            </div>
            {formError && <div style={{ color: 'var(--fd-red)', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="report-footer">
        <span className="rf-brand"><i className="fa fa-user-doctor"></i> Finance Doctor</span>
        <span>Financial year {fyDisplay}</span>
        <span className="rf-end">General information only — not financial advice.</span>
      </footer>

      {/* Toast */}
      <div className={`fd-toast${toastVisible ? ' show' : ''}`}>
        <i className="fa fa-circle-check"></i>
        <span>{toastMsg}</span>
      </div>
    </main>
  );
}
