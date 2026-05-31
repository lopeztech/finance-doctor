'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Expense } from '@/lib/types';
import { adviceChatGet, adviceChatPut, reanalyseExpenses, streamTaxAdvice } from '@/lib/functions-client';
import { extractDoctorActions, type DoctorSummaryItem } from '@/lib/doctor-summary';
import { listExpenses, updateExpense } from '@/lib/expenses-repo';
import { upsertCategoryRule } from '@/lib/category-rules-repo';
import { dateInRange, getFinancialYear, currentFinancialYear, type Period } from '@/lib/period';
import { useMember } from '@/lib/use-member';

const CATEGORIES = [
  'Clothing & Laundry', 'Donations', 'Investment Expenses', 'Investment Property',
  'Phone & Internet', 'Professional Memberships', 'Self-Education', 'Tools & Equipment',
  'Vehicle & Travel', 'Work from Home', 'Other Deductions',
];
const DEDUCTION_CATEGORIES = CATEGORIES.filter(c => c !== 'Other Deductions');

const CATEGORY_ICONS: Record<string, string> = {
  'Work from Home': 'fa-house-laptop', 'Vehicle & Travel': 'fa-car',
  'Clothing & Laundry': 'fa-shirt', 'Self-Education': 'fa-graduation-cap',
  'Tools & Equipment': 'fa-tools', 'Professional Memberships': 'fa-id-card',
  'Phone & Internet': 'fa-mobile-alt', 'Donations': 'fa-hand-holding-heart',
  'Investment Expenses': 'fa-piggy-bank', 'Investment Property': 'fa-building',
  'Other Deductions': 'fa-receipt',
};

export default function TaxPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period] = useState<Period>(null);
  const { memberId } = useMember();
  const [adviceHistory, setAdviceHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [reanalysing, setReanalysing] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const adviceHistoryRef = useRef(adviceHistory);
  adviceHistoryRef.current = adviceHistory;

  const selectedFy = period ? getFinancialYear((period as { fromYmd: string }).fromYmd) : currentFinancialYear();

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try { setExpenses(await listExpenses('all')); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    adviceChatGet('tax')
      .then(h => { if (h.length) setAdviceHistory(h); })
      .catch(() => {});
  }, []);

  const toggleNonDeductible = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    const nonDeductible = !expense.nonDeductible;
    const matching = expenses.filter(e => e.description === expense.description);
    await Promise.all(matching.map(e => updateExpense(e.id, { nonDeductible })));
    const ids = new Set(matching.map(e => e.id));
    setExpenses(prev => prev.map(e => ids.has(e.id) ? { ...e, nonDeductible } : e));
    upsertCategoryRule({ pattern: expense.description, nonDeductible }).catch(() => {});
  };

  const updateExpenseCategory = async (id: string, category: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    const matching = expenses.filter(e => e.description === expense.description);
    await Promise.all(matching.map(e => updateExpense(e.id, { category })));
    setExpenses(prev => prev.map(e => e.description === expense.description ? { ...e, category } : e));
    setEditingExpenseId(null);
    upsertCategoryRule({ pattern: expense.description, taxCategory: category }).catch(() => {});
  };

  const reanalyseOther = async () => {
    setReanalysing(true);
    try { await reanalyseExpenses({ financialYear: selectedFy }); await fetchExpenses(); } catch {}
    setReanalysing(false);
  };

  const saveChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    try { await adviceChatPut('tax', history); } catch {}
  }, []);

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    let handle;
    try { handle = await streamTaxAdvice({ financialYear: selectedFy, history, followUp }); }
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
        adviceChatPut<DoctorSummaryItem>('tax-summary', items).catch(() => {});
      }
    }
  };

  const getAdvice = async () => { setAdviceHistory([]); await streamAdvice([]); };
  const sendFollowUp = async () => {
    const q = followUpInput.trim();
    if (!q || adviceLoading) return;
    setFollowUpInput('');
    const updated = [...adviceHistory, { role: 'user' as const, text: q }];
    setAdviceHistory(updated);
    await streamAdvice(updated.slice(0, -1), q);
  };

  const filteredExpenses = expenses.filter(e => {
    if (memberId && e.owner !== memberId) return false;
    if (!dateInRange(e.date, period)) return false;
    return true;
  });

  const nonDeductibleExpenses = filteredExpenses.filter(e => e.nonDeductible);
  const deductibleExpenses    = filteredExpenses.filter(e => !e.nonDeductible);
  const deductionExpenses     = deductibleExpenses.filter(e => e.category !== 'Other Deductions');
  const otherExpenses         = deductibleExpenses.filter(e => e.category === 'Other Deductions');

  const totalDeductions      = deductionExpenses.reduce((s, e) => s + e.amount, 0);
  const totalNonDeductible   = nonDeductibleExpenses.reduce((s, e) => s + e.amount, 0);
  const totalOther           = otherExpenses.reduce((s, e) => s + e.amount, 0);

  const categoryTotals = deductionExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  const expensesByCategory = deductionExpenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e); return acc;
  }, {} as Record<string, Expense[]>);

  const getExpenseFY = (e: Expense) => e.date ? getFinancialYear(e.date) : (e.financialYear || '');
  const allDeductible = expenses.filter(e => {
    if (memberId && e.owner !== memberId) return false;
    return !e.nonDeductible && e.category !== 'Other Deductions';
  });
  const yoyByFy = allDeductible.reduce((acc, e) => {
    const key = getExpenseFY(e); if (!key) return acc;
    if (!acc[key]) acc[key] = {};
    acc[key][e.category] = (acc[key][e.category] || 0) + e.amount; return acc;
  }, {} as Record<string, Record<string, number>>);
  const yoyFys = Object.keys(yoyByFy).sort();
  const yoyTotals = yoyFys.map(fy => ({ fy, total: Object.values(yoyByFy[fy]).reduce((s, v) => s + v, 0) }));

  const taxHealthLabel = () => {
    const cats = Object.keys(categoryTotals).length;
    if (cats >= 7) return 'Healthy';
    if (cats >= 4) return 'Fair';
    return 'Building';
  };

  const lastModel = adviceHistory.filter(m => m.role === 'model').slice(-1)[0];
  const userMessages = adviceHistory.filter(m => m.role === 'user');

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const fyDisplay = selectedFy.replace('-', '–');

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
          <div className="eyebrow">Health Assessment · Tax · FY {fyDisplay}</div>
          <h1>Tax Advisor</h1>
          <p className="dek">
            {deductionExpenses.length > 0
              ? <>Your tax position for FY {fyDisplay} shows <b>${totalDeductions.toLocaleString('en-AU', { maximumFractionDigits: 0 })} in deductions</b> across {Object.keys(categoryTotals).length} of {DEDUCTION_CATEGORIES.length} categories.{otherExpenses.length > 0 ? ` ${otherExpenses.length} expense${otherExpenses.length === 1 ? '' : 's'} still need categorising.` : ''}</>
              : <>No expenses tracked for FY {fyDisplay} yet. Add your work-related expenses to see your tax deductions and get personalised advice.</>}
          </p>
        </div>
        <div className="meta">
          <div className="big">Dr Finance</div>
          {today}<br />
          Financial year {fyDisplay}
        </div>
      </div>

      {/* ── 01 Vitals ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">01</span>
          <h2>Vitals</h2>
          <div className="agg">
            <span className="tag t-teal">
              <span className="dot" style={{ background: 'var(--fd-teal)' }}></span>
              {taxHealthLabel()}
            </span>
          </div>
        </div>
        <div className="ledger">
          <div className="cell">
            <div className="k">Total deductions</div>
            <div className="v pos num">${totalDeductions.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</div>
            <div className="sub">Categorised · FY {fyDisplay}</div>
          </div>
          <div className="cell">
            <div className="k">Categories used</div>
            <div className="v num">
              {Object.keys(categoryTotals).length}{' '}
              <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>/ {DEDUCTION_CATEGORIES.length}</span>
            </div>
            <div className="sub">{DEDUCTION_CATEGORIES.length - Object.keys(categoryTotals).length} unused</div>
          </div>
          <div className="cell">
            <div className="k">Uncategorised</div>
            <div className="v num" style={{ color: otherExpenses.length > 0 ? 'var(--fd-amber)' : 'var(--ink-2)' }}>
              {otherExpenses.length}{' '}
              <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>· ${totalOther.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="sub">In &ldquo;Other Deductions&rdquo;</div>
          </div>
          <div className="cell">
            <div className="k">Non-deductible</div>
            <div className="v num" style={{ color: 'var(--ink-2)' }}>
              {nonDeductibleExpenses.length}{' '}
              <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>· ${totalNonDeductible.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="sub">Flagged &amp; excluded</div>
          </div>
        </div>
      </section>

      {/* ── 02 Diagnosis ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">02</span>
          <h2>Diagnosis</h2>
          <div className="agg">
            {lastModel ? 'Assessment by Dr Finance' : 'Run an assessment to see Dr Finance’s diagnosis'}
          </div>
        </div>
        <div className="assess">
          <div className="who">
            <span className="pic"><i className="fa fa-stethoscope"></i></span>
            <div>
              <div className="nm">Dr Finance</div>
              <div className="ts">Tax health assessment · FY {fyDisplay}</div>
            </div>
            <div className="act">
              <button className="btn btn-sm" onClick={getAdvice} disabled={adviceLoading || deductibleExpenses.length === 0}>
                <i className={`fa ${adviceLoading && !lastModel ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                {adviceLoading && !lastModel ? ' Analysing…' : lastModel ? ' New assessment' : ' Run assessment'}
              </button>
            </div>
          </div>

          {lastModel && (
            <div className="advice" dangerouslySetInnerHTML={{ __html: lastModel.text }} />
          )}

          {!lastModel && !adviceLoading && (
            <div className="advice">
              <p style={{ paddingTop: 16 }}>
                {deductibleExpenses.length > 0
                  ? 'Click “Run assessment” to get a personalised tax health diagnosis from Dr Finance, powered by Gemini AI.'
                  : 'Add some expenses first, then run the assessment.'}
              </p>
            </div>
          )}

          {adviceLoading && !lastModel && (
            <div className="advice" style={{ paddingTop: 16 }}>
              <i className="fa fa-spinner fa-spin" style={{ marginRight: 8, color: 'var(--fd-teal)' }}></i>
              <span style={{ color: 'var(--ink-3)' }}>Dr Finance is reviewing your tax position…</span>
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

          <form className="followup" onSubmit={e => { e.preventDefault(); sendFollowUp(); }}>
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

      {/* ── 03 Breakdown & Trend ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">03</span>
          <h2>Breakdown &amp; Trend</h2>
          <div className="agg">{Object.keys(categoryTotals).length} categories · {yoyFys.length} financial year{yoyFys.length === 1 ? '' : 's'}</div>
        </div>
        <div className="two">
          <div>
            <div className="subhead">Deductions by category</div>
            <div className="dlist">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat} className="dl">
                  <div className="dl-top">
                    <i className={`fa ${CATEGORY_ICONS[cat] || 'fa-receipt'}`}></i>
                    <span className="nm">{cat}</span>
                    <span className="vl num">${total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                    <span className="pc num">{totalDeductions > 0 ? `${((total / totalDeductions) * 100).toFixed(0)}%` : '—'}</span>
                  </div>
                  <div className="dl-bar">
                    <span style={{ width: totalDeductions > 0 ? `${(total / totalDeductions) * 100}%` : '0%' }}></span>
                  </div>
                </div>
              ))}
              {sortedCategories.length === 0 && (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No categorised deductions yet for FY {fyDisplay}.</div>
              )}
            </div>
          </div>
          <div>
            <div className="subhead">Year over year</div>
            {yoyTotals.length > 0 ? (
              <table className="tbl compact num">
                <thead><tr><th>Financial year</th><th>Total</th><th>Change</th></tr></thead>
                <tbody>
                  {yoyTotals.map((row, i) => {
                    const prev = i > 0 ? yoyTotals[i - 1].total : null;
                    const delta = prev !== null ? row.total - prev : null;
                    const pct   = prev && prev > 0 ? ((row.total - prev) / prev) * 100 : null;
                    return (
                      <tr key={row.fy}>
                        <td className="nm">FY {row.fy.replace('-', '–')}</td>
                        <td>${row.total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                        <td className={delta === null ? '' : delta >= 0 ? 'pos' : 'neg'}>
                          {delta === null ? '—' : `${delta >= 0 ? '+' : ''}$${Math.abs(delta).toLocaleString('en-AU', { maximumFractionDigits: 0 })}${pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Add expenses across multiple financial years to see the trend.</div>
            )}
          </div>
        </div>
      </section>

      {/* ── 04 Itemised Deductions ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">04</span>
          <h2>Itemised Deductions</h2>
          <div className="agg">Tap a category to expand line items</div>
        </div>

        {sortedCategories.map(([category, total]) => {
          const isExpanded = expandedCategories.has(category);
          const catExpenses = [...(expensesByCategory[category] || [])].sort((a, b) => b.amount - a.amount);
          return (
            <div key={category} className="cat-line" style={{ flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpandedCategories(prev => { const n = new Set(prev); n.has(category) ? n.delete(category) : n.add(category); return n; })}>
              <span className="ci"><i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'}`} style={{ color: 'var(--ink-3)' }}></i></span>
              <span className="nm">{category}</span>
              <span className="ct">
                <span className="cnt">{catExpenses.length} item{catExpenses.length !== 1 ? 's' : ''}</span>
                <span className="amt num">${total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                <i className={`fa fa-chevron-${isExpanded ? 'down' : 'right'}`} style={{ color: 'var(--ink-3)', fontSize: 11 }}></i>
              </span>
              {isExpanded && (
                <div style={{ flexBasis: '100%', marginTop: 8, marginLeft: 28 }}>
                  <table className="tbl compact num" style={{ marginBottom: 0 }}>
                    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th></th></tr></thead>
                    <tbody>
                      {catExpenses.map(e => (
                        <tr key={e.id}>
                          <td style={{ color: 'var(--ink-3)' }}>{new Date(e.date).toLocaleDateString('en-AU')}</td>
                          <td style={{ textAlign: 'left' }}>{e.description}</td>
                          <td>${e.amount.toFixed(2)}</td>
                          <td style={{ textAlign: 'left', width: 160 }}>
                            {editingExpenseId === e.id ? (
                              <select
                                style={{ font: 'inherit', fontSize: 12, padding: '3px 8px', border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', width: 150 }}
                                autoFocus
                                value={e.category}
                                onChange={ev => updateExpenseCategory(e.id, ev.target.value)}
                                onBlur={() => setEditingExpenseId(null)}
                                onClick={ev => ev.stopPropagation()}
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <div style={{ display: 'flex', gap: 8 }} onClick={ev => ev.stopPropagation()}>
                                <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-teal)', fontSize: 11.5, fontWeight: 700 }} onClick={() => setEditingExpenseId(e.id)}>Recategorise</button>
                                <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-red)', fontSize: 11.5, fontWeight: 700 }} onClick={() => toggleNonDeductible(e.id)}>Non-deductible</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {otherExpenses.length > 0 && (
          <div style={{ marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--rule-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--fd-amber)' }}>
                {otherExpenses.length} Uncategorised · ${totalOther.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
              </span>
              <button className="btn btn-sm" onClick={reanalyseOther} disabled={reanalysing} style={{ marginLeft: 'auto' }}>
                <i className={`fa ${reanalysing ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                {reanalysing ? ' Re-analysing…' : ' Re-analyse with AI'}
              </button>
            </div>
            <table className="tbl compact num">
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {[...otherExpenses].sort((a, b) => b.amount - a.amount).map(e => (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--ink-3)' }}>{new Date(e.date).toLocaleDateString('en-AU')}</td>
                    <td style={{ textAlign: 'left' }}>{e.description}</td>
                    <td>${e.amount.toFixed(2)}</td>
                    <td style={{ textAlign: 'left', width: 180 }}>
                      {editingExpenseId === e.id ? (
                        <select
                          style={{ font: 'inherit', fontSize: 12, padding: '3px 8px', border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', width: 170 }}
                          autoFocus value="Other Deductions"
                          onChange={ev => { const v = ev.target.value; if (v === '__nd__') toggleNonDeductible(e.id); else if (v !== 'Other Deductions') updateExpenseCategory(e.id, v); }}
                          onBlur={() => setEditingExpenseId(null)}
                        >
                          <option value="Other Deductions">— Select —</option>
                          <optgroup label="Deductible">{DEDUCTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                          <optgroup label="Non-deductible"><option value="__nd__">Mark as non-deductible</option></optgroup>
                        </select>
                      ) : (
                        <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fd-amber)', fontSize: 11.5, fontWeight: 700 }} onClick={() => setEditingExpenseId(e.id)}>Categorise</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="disclaimer" style={{ marginTop: 16 }}>
          <i className="fa fa-circle-info"></i> Totals exclude {nonDeductibleExpenses.length} non-deductible item{nonDeductibleExpenses.length !== 1 ? 's' : ''} (${totalNonDeductible.toLocaleString('en-AU', { maximumFractionDigits: 0 })}).{otherExpenses.length > 0 ? ` Sorting the ${otherExpenses.length} uncategorised item${otherExpenses.length !== 1 ? 's' : ''} would add $${totalOther.toLocaleString('en-AU', { maximumFractionDigits: 0 })} to your claim.` : ''}
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="report-footer">
        <span className="rf-brand"><i className="fa fa-user-doctor"></i> Finance Doctor</span>
        <span>Tax Advisor · FY {fyDisplay}</span>
        <span className="rf-end">General information only — not tax advice. Consult your accountant.</span>
      </footer>
    </main>
  );
}
