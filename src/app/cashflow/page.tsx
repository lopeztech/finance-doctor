'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FamilyMember, Investment, Expense, IncomeSource, IncomeSourceType, IncomeCadence, Income, EmploymentType } from '@/lib/types';
import { listFamilyMembers, addFamilyMember, updateFamilyMember, deleteFamilyMember } from '@/lib/family-members-repo';
import { listInvestments } from '@/lib/investments-repo';
import { listExpenses } from '@/lib/expenses-repo';
import { listIncomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource } from '@/lib/income-sources-repo';
import { listIncome, deleteIncome, updateIncome } from '@/lib/income-repo';
import { getCategorySettings, type CategorySettings } from '@/lib/category-settings-repo';
import { computeCashflow, type CashflowSnapshot } from '@/lib/cashflow-calc';
import { dateInRange, type Period } from '@/lib/period';
import { useMember } from '@/lib/use-member';
import { adviceChatGet, adviceChatPut, streamExpensesAdvice } from '@/lib/functions-client';
import { extractDoctorActions, type DoctorSummaryItem } from '@/lib/doctor-summary';

const CADENCES: IncomeCadence[] = ['weekly', 'fortnightly', 'monthly', 'annual'];
const INCOME_SOURCE_TYPES: { value: IncomeSourceType; label: string }[] = [
  { value: 'dividend', label: 'Dividend' },
  { value: 'interest', label: 'Interest' },
  { value: 'side', label: 'Side income' },
  { value: 'other', label: 'Other' },
];

type View = 'monthly' | 'annual';

function aud(n: number, dec = 0): string {
  const v = Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? '−$' : '$') + v;
}

export default function CashflowPage() {
  const [members, setMembers]             = useState<FamilyMember[]>([]);
  const [investments, setInvestments]     = useState<Investment[]>([]);
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [income, setIncome]               = useState<Income[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySettings>({ types: {}, excluded: [] });
  const [loading, setLoading]             = useState(true);
  const [view, setView]                   = useState<View>('monthly');
  const [period]                          = useState<Period>(null);
  const { memberId }                      = useMember();

  // Member form
  const [showMemberForm, setShowMemberForm]     = useState(false);
  const [editingMemberId, setEditingMemberId]   = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<{
    name: string; job: string; salary: string; superSalarySacrifice: string;
    employmentType: EmploymentType; daysPerWeek: string;
  }>({ name: '', job: '', salary: '', superSalarySacrifice: '', employmentType: 'full-time', daysPerWeek: '5' });

  // Other income form
  const [showIncomeForm, setShowIncomeForm]   = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeForm, setIncomeForm] = useState<{
    type: IncomeSourceType; description: string; amount: string; cadence: IncomeCadence; owner: string;
  }>({ type: 'dividend', description: '', amount: '', cadence: 'annual', owner: '' });

  // AI advice
  const [adviceHistory, setAdviceHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const adviceAnchorRef = useRef<HTMLDivElement | null>(null);

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
      setMembers(m); setInvestments(inv); setExpenses(exp);
      setIncomeSources(inc); setIncome(incomeTx); setCategorySettings(settings);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    adviceChatGet('cashflow')
      .then(h => { if (h.length) setAdviceHistory(h as { role: 'user' | 'model'; text: string }[]); })
      .catch(() => {});
  }, []);

  const saveAdviceChat = useCallback(async (h: { role: 'user' | 'model'; text: string }[]) => {
    try { await adviceChatPut('cashflow', h); } catch {}
  }, []);

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    let handle;
    try { handle = await streamExpensesAdvice({ history, followUp }); }
    catch (err) {
      const msg = `Unable to generate advice: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setAdviceHistory([...history, ...(followUp ? [{ role: 'user' as const, text: followUp }] : []), { role: 'model' as const, text: msg }]);
      setAdviceLoading(false); return;
    }
    let text = '';
    setAdviceHistory(prev => [...prev, { role: 'model', text: '' }]);
    try {
      for await (const chunk of handle.stream) {
        text += chunk;
        setAdviceHistory(prev => [...prev.slice(0, -1), { role: 'model', text }]);
      }
      text = await handle.final;
      setAdviceHistory(prev => [...prev.slice(0, -1), { role: 'model', text }]);
    } catch (err) {
      const msg = `Unable to generate advice: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setAdviceHistory(prev => [...prev.slice(0, -1), { role: 'model', text: msg }]);
      setAdviceLoading(false); return;
    }
    setAdviceLoading(false);
    const final = [...history, ...(followUp ? [{ role: 'user' as const, text: followUp }] : []), { role: 'model' as const, text }];
    saveAdviceChat(final);
    if (!followUp && history.length === 0) {
      const items = extractDoctorActions(text);
      if (items.length > 0) {
        items[0] = { ...items[0], savedAt: new Date().toISOString() };
        adviceChatPut<DoctorSummaryItem>('cashflow-summary', items).catch(() => {});
      }
    }
  };

  const getCashflowAdvice = async () => {
    setAdviceHistory([]);
    adviceAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await streamAdvice([]);
  };

  const sendAdviceFollowUp = async () => {
    const q = followUpInput.trim(); if (!q || adviceLoading) return;
    setFollowUpInput('');
    const updated = [...adviceHistory, { role: 'user' as const, text: q }];
    setAdviceHistory(updated);
    await streamAdvice(updated.slice(0, -1), q);
  };

  // Member CRUD
  const submitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPartTime = memberForm.employmentType === 'part-time';
    const daysRaw = parseFloat(memberForm.daysPerWeek);
    const days = Number.isFinite(daysRaw) ? Math.min(5, Math.max(0.5, daysRaw)) : 5;
    const body: Omit<FamilyMember, 'id'> = {
      name: memberForm.name, salary: parseFloat(memberForm.salary) || 0,
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
    setMemberForm({ name: m.name, job: m.job || '', salary: String(m.salary),
      superSalarySacrifice: m.superSalarySacrifice ? String(m.superSalarySacrifice) : '',
      employmentType: m.employmentType || 'full-time', daysPerWeek: m.daysPerWeek ? String(m.daysPerWeek) : '5' });
    setEditingMemberId(m.id); setShowMemberForm(true);
  };
  const cancelMemberForm = () => {
    setMemberForm({ name: '', job: '', salary: '', superSalarySacrifice: '', employmentType: 'full-time', daysPerWeek: '5' });
    setEditingMemberId(null); setShowMemberForm(false);
  };
  const removeMember = async (id: string) => {
    await deleteFamilyMember(id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  // Other income CRUD
  const submitIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Omit<IncomeSource, 'id'> = {
      type: incomeForm.type, description: incomeForm.description,
      amount: parseFloat(incomeForm.amount) || 0, cadence: incomeForm.cadence,
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
    setIncomeForm({ type: i.type, description: i.description, amount: String(i.amount), cadence: i.cadence, owner: i.owner || '' });
    setEditingIncomeId(i.id); setShowIncomeForm(true);
  };
  const cancelIncomeForm = () => {
    setIncomeForm({ type: 'dividend', description: '', amount: '', cadence: 'annual', owner: '' });
    setEditingIncomeId(null); setShowIncomeForm(false);
  };
  const removeIncome = async (id: string) => {
    await deleteIncomeSource(id);
    setIncomeSources(prev => prev.filter(i => i.id !== id));
  };

  const removeIncomeRow = async (id: string) => {
    await deleteIncome(id);
    setIncome(prev => prev.filter(i => i.id !== id));
  };

  const filteredExpenses = expenses.filter(e =>
    dateInRange(e.date, period) && (!memberId || e.owner === memberId)
  );
  const filteredIncome = income.filter(r =>
    dateInRange(r.date, period) && (!memberId || r.owner === memberId)
  );

  const snap: CashflowSnapshot = computeCashflow({
    members, investments, expenses: filteredExpenses, incomeSources, categorySettings, income: filteredIncome,
  });

  const mult        = view === 'monthly' ? 1 : 12;
  const suf         = view === 'monthly' ? '/mo' : '/yr';
  const taxMonthly  = snap.salariesGrossMonthly - snap.salariesNetMonthly;
  const otherIncome = snap.investmentIncomeMonthly + snap.otherIncomeMonthly;

  const lastModel    = adviceHistory.filter(m => m.role === 'model').slice(-1)[0];
  const userMessages = adviceHistory.filter(m => m.role === 'user');
  const today        = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const periodLabel  = snap.monthsCovered > 0 ? `Last ${snap.monthsCovered} month${snap.monthsCovered !== 1 ? 's' : ''}` : 'No expense data yet';

  if (loading) {
    return (
      <main className="report" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <i className="fa fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--ink-3)' }}></i>
      </main>
    );
  }

  return (
    <main className="report">
      {/* ── Report head ── */}
      <div className="report-head">
        <div className="lead">
          <div className="eyebrow">Health Assessment · Cashflow{members.length > 0 ? ` · ${members.map(m => m.name).join(' & ')}` : ''}</div>
          <h1>Cashflow Advisor</h1>
          <p className="dek">
            {members.length === 0
              ? <>Add household members with their salaries to see cashflow analysis, tax estimates, and personalised advice from Dr Finance.</>
              : snap.surplusMonthly >= 0
                ? <>Your household runs a steady monthly <b>surplus</b> of <b>{aud(snap.surplusMonthly)}</b>. Savings rate is <b>{snap.savingsRatePct.toFixed(1)}%</b>{snap.savingsRatePct < 20 ? ' — just under the 20% target. Discretionary spending is the fastest lever to close the gap.' : ' — on track.'}</>
                : <>Your household is running a monthly <b>shortfall</b> of <b>{aud(Math.abs(snap.surplusMonthly))}</b>. Reviewing discretionary and committed outflows is the first step to turning this around.</>}
          </p>
        </div>
        <div className="meta">
          <div className="big">Cashflow Advisor</div>
          {today}<br />
          {periodLabel}
        </div>
      </div>

      {/* ── 01 Vitals ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">01</span>
          <h2>Vitals</h2>
          <div className="agg">
            <div className="fy">
              <button className={view === 'monthly' ? 'on' : ''} onClick={() => setView('monthly')}>Monthly</button>
              <button className={view === 'annual' ? 'on' : ''} onClick={() => setView('annual')}>Annual</button>
            </div>
          </div>
        </div>
        <div className="ledger">
          <div className="cell">
            <div className="k">Net income {suf}</div>
            <div className="v pos num">{aud(snap.totalIncomeMonthly * mult)}</div>
            <div className="sub">Salaries + investment income</div>
          </div>
          <div className="cell">
            <div className="k">Outflows {suf}</div>
            <div className="v num" style={{ color: 'var(--fd-amber)' }}>{aud(snap.outflowsMonthly * mult)}</div>
            <div className="sub">Loans + living expenses</div>
          </div>
          <div className="cell">
            <div className="k">Surplus {suf}</div>
            <div className={`v num ${snap.surplusMonthly >= 0 ? 'pos' : 'neg'}`}>
              {snap.surplusMonthly >= 0 ? '' : '−'}{aud(Math.abs(snap.surplusMonthly) * mult)}
            </div>
            <div className="sub">After all outflows</div>
          </div>
          <div className="cell">
            <div className="k">Savings rate</div>
            <div className="v num" style={{ color: snap.savingsRatePct >= 20 ? 'var(--fd-teal)' : 'var(--fd-amber)' }}>
              {snap.savingsRatePct.toFixed(1)}%
            </div>
            <div className="sub">{snap.savingsRatePct >= 20 ? 'Above target' : 'Target 20%'}</div>
          </div>
        </div>
      </section>

      {/* ── 02 Diagnosis ── */}
      <section className="section" ref={adviceAnchorRef}>
        <div className="sec-head">
          <span className="no">02</span>
          <h2>Diagnosis</h2>
          <div className="agg">{lastModel ? 'Assessment by Dr Finance' : 'Run an assessment for cashflow insights'}</div>
        </div>
        <div className="assess">
          <div className="who">
            <span className="pic"><i className="fa fa-stethoscope"></i></span>
            <div>
              <div className="nm">Dr Finance</div>
              <div className="ts">Cashflow health assessment · {periodLabel}</div>
            </div>
            <div className="act">
              <button className="btn btn-sm" onClick={getCashflowAdvice} disabled={adviceLoading || members.length === 0}>
                <i className={`fa ${adviceLoading && !lastModel ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                {adviceLoading && !lastModel ? ' Analysing…' : lastModel ? ' New assessment' : ' Run assessment'}
              </button>
            </div>
          </div>

          {lastModel && <div className="advice" dangerouslySetInnerHTML={{ __html: lastModel.text }} />}
          {!lastModel && !adviceLoading && (
            <div className="advice">
              <p style={{ paddingTop: 16 }}>
                {members.length > 0
                  ? 'Click "Run assessment" for a personalised cashflow health analysis from Dr Finance.'
                  : 'Add household members first, then run the assessment.'}
              </p>
            </div>
          )}
          {adviceLoading && !lastModel && (
            <div className="advice" style={{ paddingTop: 16 }}>
              <i className="fa fa-spinner fa-spin" style={{ marginRight: 8, color: 'var(--fd-teal)' }}></i>
              <span style={{ color: 'var(--ink-3)' }}>Dr Finance is reviewing your cashflow…</span>
            </div>
          )}

          {/* Follow-up thread */}
          {userMessages.length > 0 && (
            <div className="followup-thread">
              {adviceHistory.slice(1).map((msg, i) => (
                <div key={i} className={`fu-msg ${msg.role}`}>
                  {msg.role === 'user'
                    ? <><i className="fa fa-user" style={{ marginRight: 6, color: 'var(--ink-3)' }}></i>{msg.text}</>
                    : <div dangerouslySetInnerHTML={{ __html: msg.text }} />}
                </div>
              ))}
            </div>
          )}

          <form className="followup" onSubmit={e => { e.preventDefault(); sendAdviceFollowUp(); }}>
            <input
              type="text"
              placeholder="Ask Dr Finance a follow-up question…"
              value={followUpInput}
              onChange={e => setFollowUpInput(e.target.value)}
              disabled={adviceLoading}
            />
            <button type="submit" className="btn btn-fill btn-sm" disabled={!followUpInput.trim() || adviceLoading}>
              <i className="fa fa-paper-plane"></i>
            </button>
          </form>
        </div>
      </section>

      {/* ── 03 Income & Outflows ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">03</span>
          <h2>Income &amp; Outflows</h2>
          <div className="agg">Net income {aud(snap.totalIncomeMonthly * mult)} {suf}</div>
        </div>

        {/* Net position bar */}
        {snap.totalIncomeMonthly > 0 && (
          <>
            <div className="alloc-bar" style={{ height: 24, marginBottom: 8 }}>
              <span style={{ width: `${Math.min(100, (snap.outflowsMonthly / snap.totalIncomeMonthly) * 100)}%`, background: 'var(--fd-amber)' }}></span>
              <span style={{ width: `${Math.max(0, (snap.surplusMonthly / snap.totalIncomeMonthly) * 100)}%`, background: 'var(--fd-teal)' }}></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 22 }}>
              <span><b style={{ color: 'var(--fd-amber)' }}>Outflows</b> {aud(snap.outflowsMonthly * mult)} · {Math.round((snap.outflowsMonthly / snap.totalIncomeMonthly) * 100)}%</span>
              <span><b style={{ color: 'var(--fd-teal)' }}>Surplus</b> {aud(Math.abs(snap.surplusMonthly) * mult)} · {Math.max(0, Math.round((snap.surplusMonthly / snap.totalIncomeMonthly) * 100))}%</span>
            </div>
          </>
        )}

        <div className="two">
          {/* Income breakdown */}
          <div>
            <div className="subhead">Income breakdown</div>
            <table className="tbl compact num">
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left' }}>
                    <i className="fa fa-briefcase" style={{ width: 18, color: 'var(--ink-3)', marginRight: 8 }}></i>
                    Salaries (gross)
                  </td>
                  <td>{aud(snap.salariesGrossMonthly * mult)}</td>
                </tr>
                {taxMonthly > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <i className="fa fa-minus" style={{ width: 18, color: 'var(--ink-3)', marginRight: 8 }}></i>
                      Tax, Medicare &amp; super
                    </td>
                    <td className="neg">−{aud(taxMonthly * mult)}</td>
                  </tr>
                )}
                {otherIncome > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <i className="fa fa-circle-dollar-to-slot" style={{ width: 18, color: 'var(--ink-3)', marginRight: 8 }}></i>
                      Investment &amp; other income
                    </td>
                    <td>{aud(otherIncome * mult)}</td>
                  </tr>
                )}
                {incomeSources.map(src => {
                  const monthly = src.cadence === 'annual' ? src.amount / 12
                    : src.cadence === 'fortnightly' ? (src.amount * 26) / 12
                    : src.cadence === 'weekly' ? (src.amount * 52) / 12
                    : src.amount;
                  return (
                    <tr key={src.id}>
                      <td style={{ textAlign: 'left' }}>
                        <i className="fa fa-circle-dollar-to-slot" style={{ width: 18, color: 'var(--ink-3)', marginRight: 8 }}></i>
                        {src.description || src.type}
                      </td>
                      <td>{aud(monthly * mult)}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--ink)' }}>
                  <td style={{ textAlign: 'left', fontWeight: 800 }}>Net income {suf}</td>
                  <td style={{ fontWeight: 800 }} className="pos">{aud(snap.totalIncomeMonthly * mult)}</td>
                </tr>
              </tbody>
            </table>

            {/* Add other income */}
            <div style={{ marginTop: 16 }}>
              {!showIncomeForm ? (
                <button className="btn btn-sm" onClick={() => setShowIncomeForm(true)}>
                  <i className="fa fa-plus"></i> Add other income
                </button>
              ) : (
                <form onSubmit={submitIncome} style={{ marginTop: 8 }}>
                  <div className="qform" style={{ gridTemplateColumns: '1fr 1fr auto', gap: 10, padding: 14 }}>
                    <div className="fld">
                      <label>Description</label>
                      <input type="text" value={incomeForm.description} onChange={e => setIncomeForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Dividends" required />
                    </div>
                    <div className="fld">
                      <label>Amount</label>
                      <input type="number" min={0} step="0.01" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))} required />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      <button type="submit" className="btn btn-fill btn-sm">
                        <i className="fa fa-check"></i>
                      </button>
                      <button type="button" className="btn btn-sm" onClick={cancelIncomeForm}>
                        <i className="fa fa-times"></i>
                      </button>
                    </div>
                  </div>
                  <div className="qform" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14, paddingTop: 0 }}>
                    <div className="fld">
                      <label>Type</label>
                      <select value={incomeForm.type} onChange={e => setIncomeForm(f => ({ ...f, type: e.target.value as IncomeSourceType }))}>
                        {INCOME_SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="fld">
                      <label>Cadence</label>
                      <select value={incomeForm.cadence} onChange={e => setIncomeForm(f => ({ ...f, cadence: e.target.value as IncomeCadence }))}>
                        {CADENCES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                </form>
              )}
              {incomeSources.map(src => (
                <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--rule-2)', fontSize: 12.5 }}>
                  <span style={{ flex: 1 }}>{src.description || src.type} · {src.cadence}</span>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fd-teal)', fontSize: 11.5, fontWeight: 700, padding: 0 }} onClick={() => editIncome(src)}>Edit</button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fd-red)', fontSize: 11.5, fontWeight: 700, padding: 0 }} onClick={() => removeIncome(src.id)}>Delete</button>
                </div>
              ))}
            </div>
          </div>

          {/* Outflow breakdown */}
          <div>
            <div className="subhead">Outflow breakdown</div>
            <table className="tbl compact num">
              <tbody>
                {snap.loanRepaymentsMonthly > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <span className="dot" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--fd-blue)', marginRight: 9 }}></span>
                      Loan repayments
                    </td>
                    <td>{aud(snap.loanRepaymentsMonthly * mult)}</td>
                  </tr>
                )}
                {snap.expensesByTypeMonthly.essential > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <span className="dot" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--fd-green)', marginRight: 9 }}></span>
                      Essential
                    </td>
                    <td>{aud(snap.expensesByTypeMonthly.essential * mult)}</td>
                  </tr>
                )}
                {snap.expensesByTypeMonthly.committed > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <span className="dot" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--fd-amber)', marginRight: 9 }}></span>
                      Committed
                    </td>
                    <td>{aud(snap.expensesByTypeMonthly.committed * mult)}</td>
                  </tr>
                )}
                {snap.expensesByTypeMonthly.discretionary > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <span className="dot" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--fd-red)', marginRight: 9 }}></span>
                      Discretionary
                    </td>
                    <td>{aud(snap.expensesByTypeMonthly.discretionary * mult)}</td>
                  </tr>
                )}
                {(snap.expensesByTypeMonthly.unclassified ?? 0) > 0 && (
                  <tr>
                    <td style={{ textAlign: 'left' }}>
                      <span className="dot" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--ink-3)', marginRight: 9 }}></span>
                      Unclassified
                    </td>
                    <td>{aud((snap.expensesByTypeMonthly.unclassified ?? 0) * mult)}</td>
                  </tr>
                )}
                {snap.outflowsMonthly === 0 && (
                  <tr>
                    <td colSpan={2} style={{ color: 'var(--ink-3)', textAlign: 'left' }}>No outflows tracked yet.</td>
                  </tr>
                )}
                {snap.outflowsMonthly > 0 && (
                  <tr style={{ borderTop: '2px solid var(--ink)' }}>
                    <td style={{ textAlign: 'left', fontWeight: 800 }}>Total outflows {suf}</td>
                    <td style={{ fontWeight: 800 }}>{aud(snap.outflowsMonthly * mult)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 04 Household Members ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">04</span>
          <h2>Household Members</h2>
          <div className="agg">After-tax position</div>
        </div>

        {snap.members.length > 0 && (
          <div className="tbl-scroll" style={{ marginBottom: 20 }}>
            <table className="tbl num">
              <thead>
                <tr>
                  <th>Member</th><th>Salary</th><th>Taxable</th><th>Tax + ML</th>
                  <th>{view === 'monthly' ? 'Net / mo' : 'Net / yr'}</th><th>Marginal</th><th></th>
                </tr>
              </thead>
              <tbody>
                {snap.members.map(m => (
                  <tr key={m.id}>
                    <td className="nm">{m.name}</td>
                    <td>{aud(m.grossAnnual)}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{aud(m.taxableIncome)}</td>
                    <td className="neg">{aud(m.totalTax)}</td>
                    <td style={{ fontWeight: 800 }}>{aud(view === 'monthly' ? m.netMonthly : m.netAnnual)}</td>
                    <td>
                      <span className="tag t-gray" style={{ borderColor: 'var(--rule)' }}>
                        {m.marginalRate}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', width: 80 }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fd-teal)', fontSize: 11.5, fontWeight: 700, padding: 0, marginRight: 10 }}
                        onClick={() => { const full = members.find(fm => fm.id === m.id); if (full) editMember(full); }}>Edit</button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fd-red)', fontSize: 11.5, fontWeight: 700, padding: 0 }}
                        onClick={() => removeMember(m.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add / edit member form */}
        {!showMemberForm ? (
          <button className="btn btn-sm" onClick={() => setShowMemberForm(true)}>
            <i className="fa fa-plus"></i> Add member
          </button>
        ) : (
          <form onSubmit={submitMember}>
            <div className="qform" style={{ gridTemplateColumns: 'repeat(3,1fr) auto', marginBottom: 12 }}>
              <div className="fld">
                <label>Name</label>
                <input type="text" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sarah" required />
              </div>
              <div className="fld">
                <label>Annual salary (AUD)</label>
                <input type="number" min={0} step="1" value={memberForm.salary} onChange={e => setMemberForm(f => ({ ...f, salary: e.target.value }))} placeholder="e.g. 95000" required />
              </div>
              <div className="fld">
                <label>Job title (optional)</label>
                <input type="text" value={memberForm.job} onChange={e => setMemberForm(f => ({ ...f, job: e.target.value }))} placeholder="e.g. Engineer" />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-fill btn-sm">
                  <i className="fa fa-check"></i> {editingMemberId ? 'Save' : 'Add'}
                </button>
                <button type="button" className="btn btn-sm" onClick={cancelMemberForm}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {snap.members.length === 0 && !showMemberForm && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 12 }}>
            No members yet — add salary data to see after-tax income and cashflow calculations.
          </div>
        )}

        <p className="disclaimer" style={{ marginTop: 16 }}>
          <i className="fa fa-circle-info"></i> Based on {snap.monthsCovered > 0 ? `${snap.monthsCovered} months of expense data` : 'current salaries'}, current salaries, super contributions, and other income. Used as a guide — figures are estimates.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="report-footer">
        <span className="rf-brand"><i className="fa fa-user-doctor"></i> Finance Doctor</span>
        <span>Cashflow Advisor · {today}</span>
        <span className="rf-end">General information only — not financial advice.</span>
      </footer>
    </main>
  );
}
