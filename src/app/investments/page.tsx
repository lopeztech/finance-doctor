'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Investment, FamilyMember } from '@/lib/types';
import { adviceChatGet, adviceChatPut, streamInvestmentsAdvice, refreshInvestmentPrices } from '@/lib/functions-client';
import { extractDoctorActions, type DoctorSummaryItem } from '@/lib/doctor-summary';
import { listInvestments, addInvestment, updateInvestment, deleteInvestment } from '@/lib/investments-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';

const INVESTMENT_TYPES = [
  'Australian Shares', 'International Shares', 'ETFs', 'Property',
  'Cryptocurrency', 'Cash / Term Deposit', 'Bonds', 'Superannuation', 'Other',
];
const TRADED_TYPES = ['Australian Shares', 'International Shares', 'ETFs', 'Cryptocurrency'];

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

interface FormState {
  name: string; type: string; owner: string;
  units: string; buyPricePerUnit: string; currentValue: string; ticker: string;
  purchasePrice: string; address: string; rentalIncomeMonthly: string;
  liability: string; interestRate: string; monthlyRepayment: string; propertyType: string;
  amount: string; faceValue: string; couponRate: string; maturityDate: string;
  balance: string; employerContribution: string;
}
const EMPTY_FORM: FormState = {
  name: '', type: INVESTMENT_TYPES[0], owner: '',
  units: '', buyPricePerUnit: '', currentValue: '', ticker: '',
  purchasePrice: '', address: '', rentalIncomeMonthly: '', liability: '',
  interestRate: '', monthlyRepayment: '', propertyType: 'Investment',
  amount: '', faceValue: '', couponRate: '', maturityDate: '',
  balance: '', employerContribution: '',
};

function buildInvestment(form: FormState): Omit<Investment, 'id'> {
  const base = { name: form.name, type: form.type, ...(form.owner ? { owner: form.owner } : {}) };
  if (TRADED_TYPES.includes(form.type)) {
    const units = parseFloat(form.units), buyPrice = parseFloat(form.buyPricePerUnit);
    const ticker = form.ticker.trim().toUpperCase();
    return { ...base, units, buyPricePerUnit: buyPrice, costBasis: units * buyPrice,
      currentValue: parseFloat(form.currentValue), ...(ticker ? { ticker } : {}) };
  }
  if (form.type === 'Property') {
    return { ...base, propertyType: form.propertyType as 'Investment' | 'Owner Occupied',
      costBasis: parseFloat(form.purchasePrice), currentValue: parseFloat(form.currentValue),
      rentalIncomeMonthly: parseFloat(form.rentalIncomeMonthly) || 0,
      liability: parseFloat(form.liability) || 0,
      ...(form.address ? { address: form.address } : {}),
      ...(parseFloat(form.interestRate) > 0 ? { interestRate: parseFloat(form.interestRate) } : {}),
      ...(parseFloat(form.monthlyRepayment) > 0 ? { monthlyRepayment: parseFloat(form.monthlyRepayment) } : {}) };
  }
  if (form.type === 'Cash / Term Deposit') {
    const amt = parseFloat(form.amount);
    return { ...base, costBasis: amt, currentValue: amt, interestRate: parseFloat(form.interestRate) || 0 };
  }
  if (form.type === 'Bonds') {
    const fv = parseFloat(form.faceValue);
    return { ...base, costBasis: fv, currentValue: fv, couponRate: parseFloat(form.couponRate) || 0, maturityDate: form.maturityDate };
  }
  if (form.type === 'Superannuation') {
    const bal = parseFloat(form.balance);
    return { ...base, costBasis: bal, currentValue: bal, employerContribution: parseFloat(form.employerContribution) || 0 };
  }
  return { ...base, costBasis: parseFloat(form.purchasePrice) || 0, currentValue: parseFloat(form.currentValue) || 0 };
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adviceHistory, setAdviceHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const adviceHistoryRef = useRef(adviceHistory);
  adviceHistoryRef.current = adviceHistory;

  const saveChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    try { await adviceChatPut('investments', history); } catch {}
  }, []);

  useEffect(() => {
    adviceChatGet('investments')
      .then(h => { if (h.length) setAdviceHistory(h); }).catch(() => {});
  }, []);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try { setInvestments(await listInvestments()); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchInvestments();
    listFamilyMembers().then(setFamilyMembers).catch(() => setFamilyMembers([]));
  }, [fetchInvestments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const data = buildInvestment(form);
    try {
      if (editingId) {
        await updateInvestment(editingId, data);
        setInvestments(prev => prev.map(i => i.id === editingId ? { id: editingId, ...data } : i));
      } else {
        const saved = await addInvestment(data);
        setInvestments(prev => [...prev, saved]);
      }
      cancelEdit();
    } finally { setSaving(false); }
  };

  const startEdit = (inv: Investment) => {
    const f: FormState = { ...EMPTY_FORM, name: inv.name, type: inv.type, owner: inv.owner || '' };
    if (TRADED_TYPES.includes(inv.type)) {
      f.units = String(inv.units || ''); f.buyPricePerUnit = String(inv.buyPricePerUnit || '');
      f.currentValue = String(inv.currentValue); f.ticker = inv.ticker || '';
    } else if (inv.type === 'Property') {
      f.propertyType = inv.propertyType || 'Investment'; f.address = inv.address || '';
      f.purchasePrice = String(inv.costBasis); f.currentValue = String(inv.currentValue);
      f.liability = String(inv.liability || ''); f.interestRate = String(inv.interestRate || '');
      f.rentalIncomeMonthly = inv.rentalIncomeMonthly ? String(inv.rentalIncomeMonthly) : '';
    } else if (inv.type === 'Cash / Term Deposit') {
      f.amount = String(inv.currentValue); f.interestRate = String(inv.interestRate || '');
    } else if (inv.type === 'Bonds') {
      f.faceValue = String(inv.costBasis); f.couponRate = String(inv.couponRate || ''); f.maturityDate = inv.maturityDate || '';
    } else if (inv.type === 'Superannuation') {
      f.balance = String(inv.currentValue); f.employerContribution = String(inv.employerContribution || '');
    } else {
      f.purchasePrice = String(inv.costBasis); f.currentValue = String(inv.currentValue);
    }
    setForm(f); setEditingId(inv.id); setShowForm(true);
  };
  const cancelEdit = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(false); };

  const removeInvestment = async (id: string) => {
    if (!confirm('Delete this holding?')) return;
    await deleteInvestment(id);
    setInvestments(prev => prev.filter(i => i.id !== id));
  };

  const refreshPrices = async () => {
    setRefreshing(true);
    try {
      const res = await refreshInvestmentPrices();
      if (res.updated > 0) {
        const byId = new Map(res.results.filter(r => r.ok).map(r => [r.id, r]));
        setInvestments(prev => prev.map(inv => {
          const r = byId.get(inv.id); if (!r) return inv;
          return { ...inv, currentValue: r.currentValue ?? inv.currentValue,
            lastPrice: r.price, lastPriceCurrency: r.currency, lastPriceUpdate: r.updatedAt };
        }));
      }
    } catch {}
    finally { setRefreshing(false); }
  };

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    let handle;
    try { handle = await streamInvestmentsAdvice({ history, followUp }); }
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
    saveChat(final);
    if (!followUp && history.length === 0) {
      const items = extractDoctorActions(text);
      if (items.length > 0) {
        items[0] = { ...items[0], savedAt: new Date().toISOString() };
        adviceChatPut<DoctorSummaryItem>('investments-summary', items).catch(() => {});
      }
    }
  };
  const getAdvice = async () => { setAdviceHistory([]); await streamAdvice([]); };
  const sendFollowUp = async () => {
    const q = followUpInput.trim(); if (!q || adviceLoading) return;
    setFollowUpInput('');
    const updated = [...adviceHistory, { role: 'user' as const, text: q }];
    setAdviceHistory(updated);
    await streamAdvice(updated.slice(0, -1), q);
  };

  // Derived calculations
  const totalValue   = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalCost    = investments.reduce((s, i) => s + i.costBasis, 0);
  const totalGainLoss = investments.reduce((s, i) =>
    s + (i.liability ? i.currentValue - i.liability : i.currentValue - i.costBasis), 0);
  const totalReturnPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue; return acc;
  }, {} as Record<string, number>);
  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

  const allocationByOwner = investments.reduce((acc, i) => {
    const key = i.owner || 'Unassigned';
    acc[key] = (acc[key] || 0) + i.currentValue; return acc;
  }, {} as Record<string, number>);

  const typeCount = Object.keys(allocationByType).length;
  const maxPct = totalValue > 0 ? Math.max(...Object.values(allocationByType).map(v => (v / totalValue) * 100)) : 0;
  const healthLabel = investments.length === 0 ? null
    : typeCount >= 4 && maxPct < 60 ? 'Healthy' : typeCount >= 2 ? 'Fair' : 'Building';

  const largestEntry = sortedAllocations[0];
  const largestPct = largestEntry && totalValue > 0 ? ((largestEntry[1] / totalValue) * 100).toFixed(0) : '—';

  const gainLossItems = investments
    .map(i => {
      const gl = i.liability ? i.currentValue - i.liability : i.currentValue - i.costBasis;
      const base = i.liability ? i.liability : i.costBasis;
      const pct = base > 0 ? (gl / base) * 100 : 0;
      return { id: i.id, name: i.name, type: i.type, gainLoss: gl, returnPct: pct };
    })
    .filter(i => i.gainLoss !== 0)
    .sort((a, b) => Math.abs(b.gainLoss) - Math.abs(a.gainLoss))
    .slice(0, 8);
  const maxAbsGL = gainLossItems.length > 0 ? Math.max(...gainLossItems.map(i => Math.abs(i.gainLoss))) : 1;

  const lastModel = adviceHistory.filter(m => m.role === 'model').slice(-1)[0];
  const userMessages = adviceHistory.filter(m => m.role === 'user');
  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

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
          <div className="eyebrow">Health Assessment · Investments · Portfolio</div>
          <h1>Investment Portfolio</h1>
          <p className="dek">
            {investments.length > 0
              ? <>Your portfolio is <b>{healthLabel || 'building'}</b> — <b>${totalValue.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</b> across {typeCount} asset class{typeCount !== 1 ? 'es' : ''}, {totalGainLoss >= 0 ? `up ${totalReturnPct.toFixed(1)}%` : `down ${Math.abs(totalReturnPct).toFixed(1)}%`} on cost.</>
              : <>Add your investments to see portfolio analysis, allocation breakdown, and personalised advice from Dr Finance.</>}
          </p>
        </div>
        <div className="meta">
          <div className="big">Investment Portfolio</div>
          {today}<br />
          {investments.length} holding{investments.length !== 1 ? 's' : ''}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={refreshPrices} disabled={refreshing}>
              <i className={`fa ${refreshing ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
              {refreshing ? ' Refreshing…' : ' Refresh prices'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 01 Vitals ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">01</span>
          <h2>Vitals</h2>
          <div className="agg">
            {healthLabel && (
              <span className="tag t-teal">
                <span className="dot" style={{ background: 'var(--fd-teal)' }}></span>{healthLabel}
              </span>
            )}
          </div>
        </div>
        <div className="ledger">
          <div className="cell">
            <div className="k">Portfolio value</div>
            <div className="v num">${totalValue.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</div>
            <div className="sub">{typeCount} asset class{typeCount !== 1 ? 'es' : ''} · {investments.length} holding{investments.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="cell">
            <div className="k">Invested (cost)</div>
            <div className="v num" style={{ color: 'var(--ink-2)' }}>${totalCost.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</div>
            <div className="sub">Total cost base</div>
          </div>
          <div className="cell">
            <div className="k">Gain / loss</div>
            <div className={`v num ${totalGainLoss >= 0 ? 'pos' : 'neg'}`}>
              {totalGainLoss >= 0 ? '+' : ''}${Math.abs(totalGainLoss).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
            </div>
            <div className="sub">{totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}% all-time</div>
          </div>
          <div className="cell">
            <div className="k">Largest holding</div>
            <div className="v num" style={{ color: 'var(--fd-indigo)' }}>{largestPct}%</div>
            <div className="sub">{largestEntry ? largestEntry[0] : '—'}</div>
          </div>
        </div>
      </section>

      {/* ── 02 Diagnosis ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">02</span>
          <h2>Diagnosis</h2>
          <div className="agg">{lastModel ? 'Assessment by Dr Finance' : 'Run an assessment for portfolio insights'}</div>
        </div>
        <div className="assess">
          <div className="who">
            <span className="pic"><i className="fa fa-stethoscope"></i></span>
            <div>
              <div className="nm">Dr Finance</div>
              <div className="ts">Investment health assessment · {today}</div>
            </div>
            <div className="act">
              <button className="btn btn-sm" onClick={getAdvice} disabled={adviceLoading || investments.length === 0}>
                <i className={`fa ${adviceLoading && !lastModel ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                {adviceLoading && !lastModel ? ' Analysing…' : lastModel ? ' New assessment' : ' Run assessment'}
              </button>
            </div>
          </div>

          {lastModel && <div className="advice" dangerouslySetInnerHTML={{ __html: lastModel.text }} />}
          {!lastModel && !adviceLoading && (
            <div className="advice">
              <p style={{ paddingTop: 16 }}>
                {investments.length > 0
                  ? 'Click "Run assessment" to get a personalised investment portfolio analysis from Dr Finance.'
                  : 'Add some investments first, then run the assessment.'}
              </p>
            </div>
          )}
          {adviceLoading && !lastModel && (
            <div className="advice" style={{ paddingTop: 16 }}>
              <i className="fa fa-spinner fa-spin" style={{ marginRight: 8, color: 'var(--fd-teal)' }}></i>
              <span style={{ color: 'var(--ink-3)' }}>Dr Finance is reviewing your portfolio…</span>
            </div>
          )}
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
          <form className="followup" onSubmit={e => { e.preventDefault(); sendFollowUp(); }}>
            <input type="text" placeholder="Ask Dr Finance a follow-up question…"
              value={followUpInput} onChange={e => setFollowUpInput(e.target.value)} disabled={adviceLoading} />
            <button type="submit" className="btn btn-fill btn-sm" disabled={!followUpInput.trim() || adviceLoading}>
              <i className="fa fa-paper-plane"></i>
            </button>
          </form>
        </div>
      </section>

      {/* ── 03 Allocation ── */}
      {sortedAllocations.length > 0 && (
        <section className="section">
          <div className="sec-head">
            <span className="no">03</span>
            <h2>Allocation</h2>
            <div className="agg">By asset class &amp; by owner</div>
          </div>
          <div className="alloc-bar">
            {sortedAllocations.map(([type, value]) => (
              <span key={type} style={{ width: `${(value / totalValue) * 100}%`, background: ALLOC_COLORS[type] || 'var(--ink-3)' }}
                title={`${type} · ${((value / totalValue) * 100).toFixed(1)}%`} />
            ))}
          </div>
          <div className="two" style={{ marginTop: 20 }}>
            <div>
              <div className="subhead">By asset class</div>
              <div className="dlist">
                {sortedAllocations.map(([type, value]) => (
                  <div key={type} className="dl">
                    <div className="dl-top">
                      <span className="dot" style={{ background: ALLOC_COLORS[type] || 'var(--ink-3)', width: 8, height: 8, flexShrink: 0 }}></span>
                      <span className="nm">{type}</span>
                      <span className="vl num">${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                      <span className="pc num">{((value / totalValue) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="dl-bar">
                      <span style={{ width: `${(value / totalValue) * 100}%`, background: ALLOC_COLORS[type] || 'var(--ink-3)' }}></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="subhead">By owner</div>
              <div className="dlist">
                {Object.entries(allocationByOwner).sort(([, a], [, b]) => b - a).map(([owner, value]) => (
                  <div key={owner} className="dl">
                    <div className="dl-top">
                      <i className="fa fa-user" style={{ width: 17, textAlign: 'center', color: 'var(--ink-3)' }}></i>
                      <span className="nm">{owner}</span>
                      <span className="vl num">${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                      <span className="pc num">{((value / totalValue) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="dl-bar">
                      <span style={{ width: `${(value / totalValue) * 100}%` }}></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 04 Holdings ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">04</span>
          <h2>Holdings</h2>
          <div className="agg">
            {investments.length} holding{investments.length !== 1 ? 's' : ''}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowForm(v => !v)}>
              <i className={`fa ${showForm ? 'fa-minus' : 'fa-plus'}`}></i> {showForm ? 'Hide form' : 'Add holding'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
            <div className="qform" style={{ gridTemplateColumns: 'repeat(3,1fr) auto', marginBottom: 12 }}>
              <div className="fld">
                <label>Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. VAS.AX" required />
              </div>
              <div className="fld">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Owner</label>
                <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  <option value="Joint">Joint</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-fill btn-sm" disabled={saving}>
                  <i className={`fa ${saving ? 'fa-spinner fa-spin' : editingId ? 'fa-check' : 'fa-plus'}`}></i>
                  {saving ? ' Saving…' : editingId ? ' Save' : ' Add'}
                </button>
                {editingId && <button type="button" className="btn btn-sm" onClick={cancelEdit}>Cancel</button>}
              </div>
            </div>
            {/* Type-specific fields */}
            {TRADED_TYPES.includes(form.type) && (
              <div className="qform" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 0 }}>
                <div className="fld"><label>Units</label><input type="number" step="any" min="0" value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))} required /></div>
                <div className="fld"><label>Buy price / unit</label><input type="number" step="0.01" min="0" value={form.buyPricePerUnit} onChange={e => setForm(f => ({ ...f, buyPricePerUnit: e.target.value }))} required /></div>
                <div className="fld"><label>Current value</label><input type="number" step="0.01" min="0" value={form.currentValue} onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))} required /></div>
                <div className="fld"><label>Ticker (optional)</label><input type="text" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} placeholder="e.g. VAS.AX" /></div>
              </div>
            )}
            {form.type === 'Superannuation' && (
              <div className="qform" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 0 }}>
                <div className="fld"><label>Current balance</label><input type="number" step="0.01" min="0" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} required /></div>
                <div className="fld"><label>Employer contribution %</label><input type="number" step="0.5" min="0" value={form.employerContribution} onChange={e => setForm(f => ({ ...f, employerContribution: e.target.value }))} /></div>
              </div>
            )}
            {form.type === 'Cash / Term Deposit' && (
              <div className="qform" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 0 }}>
                <div className="fld"><label>Amount</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
                <div className="fld"><label>Interest rate % p.a.</label><input type="number" step="0.01" min="0" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} /></div>
              </div>
            )}
            {(form.type === 'Other' || form.type === 'Property') && (
              <div className="qform" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 0 }}>
                <div className="fld"><label>Cost / purchase price</label><input type="number" step="1" min="0" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} required /></div>
                <div className="fld"><label>Current value</label><input type="number" step="1" min="0" value={form.currentValue} onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))} required /></div>
              </div>
            )}
          </form>
        )}

        {investments.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '16px 0' }}>
            No holdings yet. Click "Add holding" to get started.
          </div>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl compact num">
              <thead>
                <tr><th>Holding</th><th>Type</th><th>Owner</th><th>Cost</th><th>Value</th><th>Gain / loss</th><th></th></tr>
              </thead>
              <tbody>
                {investments.map(inv => {
                  const gl = inv.liability ? inv.currentValue - inv.liability : inv.currentValue - inv.costBasis;
                  const base = inv.liability ? inv.liability : inv.costBasis;
                  const pct = base > 0 ? (gl / base) * 100 : 0;
                  const isUnassigned = !inv.owner;
                  return (
                    <tr key={inv.id}>
                      <td style={{ textAlign: 'left' }} className="nm">{inv.name}{inv.ticker ? <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{inv.ticker}</span> : null}</td>
                      <td style={{ textAlign: 'left' }}><span className="tag t-gray" style={{ fontSize: 9.5 }}>{inv.type}</span></td>
                      <td style={{ textAlign: 'left' }}>
                        <span className={`own${isUnassigned ? ' unassigned' : ''}`}>
                          {inv.owner || 'Unassigned'}
                        </span>
                      </td>
                      <td>${inv.costBasis.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                      <td>${inv.currentValue.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                      <td className={gl >= 0 ? 'pos' : 'neg'}>
                        {gl >= 0 ? '+' : ''}${Math.abs(gl).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                        <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--ink-3)' }}>({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
                      </td>
                      <td style={{ textAlign: 'left', width: 80 }}>
                        <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-teal)', fontSize: 11.5, fontWeight: 700, marginRight: 10 }} onClick={() => startEdit(inv)}>Edit</button>
                        <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-red)', fontSize: 11.5, fontWeight: 700 }} onClick={() => removeInvestment(inv.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td>${totalCost.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                  <td>${totalValue.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                  <td className={totalGainLoss >= 0 ? 'pos' : 'neg'}>
                    {totalGainLoss >= 0 ? '+' : ''}${Math.abs(totalGainLoss).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── 05 Biggest Movers ── */}
      {gainLossItems.length > 0 && (
        <section className="section">
          <div className="sec-head">
            <span className="no">05</span>
            <h2>Biggest Movers</h2>
            <div className="agg">By absolute gain / loss</div>
          </div>
          <div className="movers">
            {gainLossItems.map(item => {
              const pct = (Math.abs(item.gainLoss) / maxAbsGL) * 50;
              const isGain = item.gainLoss >= 0;
              return (
                <div key={item.id} className="mv">
                  <div className="lbl">
                    <span className="tk">{item.name}</span>
                    <span className="ty">{item.type}</span>
                  </div>
                  <div className="axis">
                    <span className="bar" style={{
                      width: `${pct}%`,
                      background: isGain ? 'var(--fd-teal)' : 'var(--fd-red)',
                      ...(isGain ? { left: '50%' } : { right: '50%' }),
                    }}></span>
                  </div>
                  <span className={`amt ${isGain ? 'pos' : 'neg'}`}>
                    {isGain ? '+' : ''}${Math.abs(item.gainLoss).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="disclaimer">
            <i className="fa fa-circle-info"></i> Green extends right (in the money), red extends left (underwater). Prices are indicative.
          </p>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="report-footer">
        <span className="rf-brand"><i className="fa fa-user-doctor"></i> Finance Doctor</span>
        <span>Investment Portfolio · {today}</span>
        <span className="rf-end">General information only — not financial advice.</span>
      </footer>
    </main>
  );
}
