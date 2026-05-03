'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense } from '@/lib/types';
import { adviceChatGet, adviceChatPut, reanalyseExpenses, streamTaxAdvice } from '@/lib/functions-client';
import { listExpenses, updateExpense } from '@/lib/expenses-repo';
import { upsertCategoryRule } from '@/lib/category-rules-repo';
import DeductionsChart from '@/components/deductions-chart';
import YoyChart from '@/components/yoy-chart';
import { ViewToggle, useViewMode } from '@/components/view-toggle';
import { FinancialYearFilter } from '@/components/period-filter';
import { dateInRange, getFinancialYear, currentFinancialYear, type Period } from '@/lib/period';
import { useMember } from '@/lib/use-member';

const CATEGORIES = [
  'Clothing & Laundry',
  'Donations',
  'Investment Expenses',
  'Investment Property',
  'Phone & Internet',
  'Professional Memberships',
  'Self-Education',
  'Tools & Equipment',
  'Vehicle & Travel',
  'Work from Home',
  'Other Deductions',
];

const DEDUCTION_CATEGORIES = CATEGORIES.filter(c => c !== 'Other Deductions');

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
  'Investment Property': 'fa-building',
  'Other Deductions': 'fa-receipt',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Work from Home': '#20c997',
  'Vehicle & Travel': '#0d6efd',
  'Clothing & Laundry': '#6f42c1',
  'Self-Education': '#fd7e14',
  'Tools & Equipment': '#6610f2',
  'Professional Memberships': '#0dcaf0',
  'Phone & Internet': '#198754',
  'Donations': '#dc3545',
  'Investment Expenses': '#ffc107',
  'Investment Property': '#795548',
  'Other Deductions': '#6c757d',
};

export default function TaxPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(null);
  const { memberId } = useMember();
  const [adviceHistory, setAdviceHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [adviceCollapsed, setAdviceCollapsed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedNonDeductible, setExpandedNonDeductible] = useState<Set<string>>(new Set());
  const [reanalysing, setReanalysing] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'description' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [mode, setMode] = useViewMode('viewMode.tax');

  const adviceHistoryRef = useRef(adviceHistory);
  adviceHistoryRef.current = adviceHistory;

  const saveChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    try { await adviceChatPut('tax', history); } catch {}
  }, []);

  useEffect(() => {
    adviceChatGet('tax')
      .then(history => { if (history.length) setAdviceHistory(history); })
      .catch(() => {});
  }, []);

  // FY-only filter, so the period always corresponds to a single FY string we
  // can pass to the tax AI calls below. Fall back to the current FY before the
  // FinancialYearFilter has had a chance to fire its first onChange.
  const selectedFy = period ? getFinancialYear(period.fromYmd) : currentFinancialYear();

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await listExpenses('all'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const toggleNonDeductible = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    const nonDeductible = !expense.nonDeductible;

    // Apply to ALL expenses with the same description
    const matching = expenses.filter(e => e.description === expense.description);
    await Promise.all(matching.map(e => updateExpense(e.id, { nonDeductible })));
    const ids = new Set(matching.map(e => e.id));
    setExpenses(prev => prev.map(e => ids.has(e.id) ? { ...e, nonDeductible } : e));

    // Save rule so future imports inherit the flag
    upsertCategoryRule({ pattern: expense.description, nonDeductible }).catch(() => {});
  };

  const toggleCategoryNonDeductible = async (category: string, makeNonDeductible: boolean) => {
    const matching = filteredExpenses.filter(e => e.category === category && e.category !== 'Other Deductions');
    await Promise.all(matching.map(e => updateExpense(e.id, { nonDeductible: makeNonDeductible })));
    const ids = new Set(matching.map(e => e.id));
    setExpenses(prev => prev.map(e => ids.has(e.id) ? { ...e, nonDeductible: makeNonDeductible } : e));

    // Save a rule per unique description so future imports inherit the flag
    const seen = new Set<string>();
    const rulePosts: Promise<unknown>[] = [];
    for (const e of matching) {
      if (seen.has(e.description)) continue;
      seen.add(e.description);
      rulePosts.push(upsertCategoryRule({ pattern: e.description, nonDeductible: makeNonDeductible }).catch(() => {}));
    }
    Promise.all(rulePosts);
  };

  const updateExpenseCategory = async (id: string, category: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    // Apply to ALL expenses with the same description
    const matching = expenses.filter(e => e.description === expense.description);
    await Promise.all(matching.map(e => updateExpense(e.id, { category })));
    setExpenses(prev => prev.map(e => e.description === expense.description ? { ...e, category } : e));
    setEditingExpenseId(null);

    // Save rule for future imports
    upsertCategoryRule({ pattern: expense.description, taxCategory: category }).catch(() => {});
  };

  const reanalyseOther = async () => {
    setReanalysing(true);
    try {
      await reanalyseExpenses({ financialYear: selectedFy });
      await fetchExpenses();
    } catch {}
    setReanalysing(false);
  };

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    let handle;
    try {
      handle = await streamTaxAdvice({ financialYear: selectedFy, history, followUp });
    } catch (err) {
      const errorMsg = `Unable to generate advice: ${err instanceof Error ? err.message : 'Unknown error'}`;
      const updated = [...history, ...(followUp ? [{ role: 'user' as const, text: followUp }] : []), { role: 'model' as const, text: errorMsg }];
      setAdviceHistory(updated);
      setAdviceLoading(false);
      return;
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
      const errorMsg = `Unable to generate advice: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setAdviceHistory(prev => [...prev.slice(0, -1), { role: 'model', text: errorMsg }]);
      setAdviceLoading(false);
      return;
    }
    setAdviceLoading(false);
    const finalHistory = [...history, ...(followUp ? [{ role: 'user' as const, text: followUp }] : []), { role: 'model' as const, text }];
    saveChat(finalHistory);
  };

  const getAdvice = async () => {
    setAdviceHistory([]);
    setAdviceCollapsed(false);
    await streamAdvice([]);
  };

  const sendFollowUp = async () => {
    const question = followUpInput.trim();
    if (!question || adviceLoading) return;
    setFollowUpInput('');
    const updatedHistory = [...adviceHistory, { role: 'user' as const, text: question }];
    setAdviceHistory(updatedHistory);
    await streamAdvice(updatedHistory.slice(0, -1), question);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleNonDeductibleCategory = (category: string) => {
    setExpandedNonDeductible(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleSort = (field: 'date' | 'description' | 'amount') => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'amount' ? 'desc' : 'asc'); }
  };

  const sortExpenses = (list: Expense[]) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'description') cmp = a.description.localeCompare(b.description);
      else cmp = a.amount - b.amount;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  const SortIcon = ({ field }: { field: 'date' | 'description' | 'amount' }) => (
    <i className={`fa fa-sort${sortField === field ? (sortDir === 'asc' ? '-up' : '-down') : ''} ms-1 text-muted`} style={{ fontSize: '0.7rem' }}></i>
  );

  const getExpenseFY = (e: Expense) => e.date ? getFinancialYear(e.date) : (e.financialYear || '');

  const filteredExpenses = expenses.filter(e => {
    if (memberId && e.owner !== memberId) return false;
    if (!dateInRange(e.date, period)) return false;
    return true;
  });

  // Split into non-deductible, then deductible (into categorised deductions vs Other)
  const nonDeductibleExpenses = filteredExpenses.filter(e => e.nonDeductible);
  const deductibleExpenses = filteredExpenses.filter(e => !e.nonDeductible);
  const deductionExpenses = deductibleExpenses.filter(e => e.category !== 'Other Deductions');
  const otherExpenses = deductibleExpenses.filter(e => e.category === 'Other Deductions');

  const totalDeductions = deductionExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalNonDeductible = nonDeductibleExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOther = otherExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = deductionExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([a], [b]) => a.localeCompare(b));

  const expensesByCategory = deductionExpenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {} as Record<string, Expense[]>);

  const nonDeductibleTotals = nonDeductibleExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedNonDeductibleCategories = Object.entries(nonDeductibleTotals).sort(([a], [b]) => a.localeCompare(b));
  const nonDeductibleByCategory = nonDeductibleExpenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {} as Record<string, Expense[]>);

  // YoY uses all expenses regardless of FY filter (but respects member filter)
  const allDeductibleExpenses = expenses.filter(e => {
    if (memberId && e.owner !== memberId) return false;
    return !e.nonDeductible && e.category !== 'Other Deductions';
  });
  const yoyByFy = allDeductibleExpenses.reduce((acc, e) => {
    const key = getExpenseFY(e);
    if (!key) return acc;
    if (!acc[key]) acc[key] = {};
    acc[key][e.category] = (acc[key][e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, Record<string, number>>);
  const yoyFys = Object.keys(yoyByFy).sort();
  const yoyTotals = yoyFys.map(fy => ({
    fy,
    total: Object.values(yoyByFy[fy]).reduce((s, v) => s + v, 0),
  }));

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="page-header mb-0">Tax Health Check</h1>
        <ViewToggle value={mode} onChange={setMode} className="ms-sm-auto" showDoctor />
      </div>

      <div className="mb-3">
        <FinancialYearFilter
          onChange={setPeriod}
          availableFys={[...new Set(expenses.map(e => getExpenseFY(e)).filter(Boolean))]}
          defaultFy="current"
          storageKey="period.tax"
        />
      </div>

      {mode === 'summary' && <>
      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="card border-0 bg-teal text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Total Deductions</div>
              <h3 className="text-white mb-0">${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-indigo text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Categories Used</div>
              <h3 className="text-white mb-0">{sortedCategories.length} / {DEDUCTION_CATEGORIES.length}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-danger text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Non-Deductible</div>
              <h3 className="text-white mb-0">{nonDeductibleExpenses.length} <small className="fs-6">(${totalNonDeductible.toLocaleString('en-AU', { minimumFractionDigits: 2 })})</small></h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-warning text-dark mb-3">
            <div className="card-body">
              <div className="text-dark text-opacity-75 mb-1">Uncategorised</div>
              <h3 className="text-dark mb-0">{otherExpenses.length} <small className="fs-6">(${totalOther.toLocaleString('en-AU', { minimumFractionDigits: 2 })})</small></h3>
            </div>
          </div>
        </div>
      </div>

      {sortedCategories.length > 0 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-chart-column me-2"></i>Deductions breakdown
              {memberId && <span className="badge bg-primary ms-2">{memberId}</span>}
            </div>
          </PanelHeader>
          <PanelBody>
            <DeductionsChart categoryTotals={categoryTotals} height={Math.max(220, sortedCategories.length * 42)} />
          </PanelBody>
        </Panel>
      )}

      {yoyFys.length >= 2 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-chart-bar me-2"></i>Year-over-Year Comparison
              {memberId && <span className="badge bg-primary ms-2">{memberId}</span>}
              <span className="ms-auto text-muted small">{yoyFys.length} financial years</span>
            </div>
          </PanelHeader>
          <PanelBody>
            <YoyChart byFy={yoyByFy} />
            <div className="table-responsive mt-3">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Financial Year</th>
                    <th className="text-end">Total Deductions</th>
                    <th className="text-end">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {yoyTotals.map((row, i) => {
                    const prev = i > 0 ? yoyTotals[i - 1].total : null;
                    const delta = prev !== null ? row.total - prev : null;
                    const pct = prev && prev > 0 ? ((row.total - prev) / prev) * 100 : null;
                    return (
                      <tr key={row.fy}>
                        <td className="fw-bold">FY {row.fy}</td>
                        <td className="text-end">${row.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                        <td className={`text-end ${delta === null ? 'text-muted' : delta >= 0 ? 'text-success' : 'text-danger'}`}>
                          {delta === null ? '—' : (
                            <>
                              {delta >= 0 ? '+' : ''}${delta.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                              {pct !== null && <small className="ms-1">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</small>}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PanelBody>
        </Panel>
      )}

      </>}

      {mode === 'doctor' && filteredExpenses.length > 0 && (
        <Panel>
          <PanelHeader noButton>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span><i className="fa fa-stethoscope me-2"></i>Tax Health Assessment</span>
              <button className="btn btn-sm btn-success ms-sm-auto" onClick={getAdvice} disabled={adviceLoading}>
                {adviceLoading && adviceHistory.length <= 1 ? <><i className="fa fa-spinner fa-spin me-1"></i>Analysing...</> : <><i className="fa fa-robot me-1"></i>{adviceHistory.length > 0 ? 'New Assessment' : 'Get AI Advice'}</>}
              </button>
            </div>
          </PanelHeader>
          <PanelBody>
            {adviceHistory.length > 0 ? (
              <>
                {adviceHistory.map((msg, i) => (
                  <div key={i} className="mb-3">
                    {msg.role === 'user' ? (
                      <div className="d-flex align-items-start mb-2">
                        <span className="badge bg-primary me-2 mt-1"><i className="fa fa-user"></i></span>
                        <div className="fw-medium">{msg.text}</div>
                      </div>
                    ) : (
                      <div className="d-flex align-items-start">
                        <span className="badge bg-teal me-2 mt-1"><i className="fa fa-stethoscope"></i></span>
                        <div className="advice-content flex-grow-1" dangerouslySetInnerHTML={{ __html: msg.text }} />
                      </div>
                    )}
                  </div>
                ))}
                {adviceLoading && adviceHistory[adviceHistory.length - 1]?.role === 'user' && (
                  <div className="d-flex align-items-start mb-3">
                    <span className="badge bg-teal me-2 mt-1"><i className="fa fa-stethoscope"></i></span>
                    <div className="text-muted"><i className="fa fa-spinner fa-spin me-1"></i>Thinking...</div>
                  </div>
                )}
                {!adviceLoading && (
                  <form onSubmit={(e) => { e.preventDefault(); sendFollowUp(); }} className="mt-3 border-top pt-3">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ask Dr Finance a follow-up question..."
                        value={followUpInput}
                        onChange={(e) => setFollowUpInput(e.target.value)}
                      />
                      <button type="submit" className="btn btn-teal" disabled={!followUpInput.trim()}>
                        <i className="fa fa-paper-plane"></i>
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="text-muted text-center py-3">
                <p className="mb-0">Click &quot;Get AI Advice&quot; for a personalised tax health assessment powered by Gemini.</p>
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      {mode === 'detail' && <>
        <Panel>
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-receipt me-2"></i>Deductions by Category
              {memberId && <span className="badge bg-primary ms-2">{memberId}</span>}
            </div>
          </PanelHeader>
            <PanelBody>
              {loading ? (
                <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
              ) : sortedCategories.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa fa-file-invoice-dollar fa-3x mb-3 d-block"></i>
                  <p>No deductions found. Upload expenses or re-analyse uncategorised items below.</p>
                </div>
              ) : (
                <div>
                  {sortedCategories.map(([category, total]) => {
                    const pct = totalDeductions > 0 ? (total / totalDeductions) * 100 : 0;
                    const color = CATEGORY_COLORS[category] || '#6c757d';
                    const isExpanded = expandedCategories.has(category);
                    const catExpenses = sortExpenses(expensesByCategory[category] || []);
                    return (
                      <div key={category} className="mb-2">
                        <div
                          className="d-flex align-items-center p-2 rounded"
                          style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'var(--bs-light)' : 'transparent' }}
                          onClick={() => toggleCategory(category)}
                        >
                          <i className={`fa fa-chevron-${isExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '12px', fontSize: '0.7rem' }}></i>
                          <i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'} me-2`} style={{ color }}></i>
                          <span className="fw-bold flex-grow-1">{category}</span>
                          <button className="btn btn-xs btn-outline-danger me-2" onClick={ev => { ev.stopPropagation(); toggleCategoryNonDeductible(category, true); }} title="Mark entire category as non-deductible">
                            <i className="fa fa-ban me-1"></i>Non-deductible
                          </button>
                          <span className="badge bg-secondary me-2">{catExpenses.length}</span>
                          <span className="fw-bold me-2">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                          <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                        {isExpanded && (
                          <div className="ms-4 mt-1 mb-2 table-responsive">
                            <table className="table table-sm table-hover mb-0">
                              <thead>
                                <tr>
                                  <th style={{ width: '90px', cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); toggleSort('date'); }}>Date<SortIcon field="date" /></th>
                                  <th style={{ cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); toggleSort('description'); }}>Description<SortIcon field="description" /></th>
                                  {catExpenses.some(e => e.owner) && <th style={{ width: '80px' }}>Owner</th>}
                                  <th className="text-end" style={{ width: '90px', cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); toggleSort('amount'); }}>Amount<SortIcon field="amount" /></th>
                                  <th style={{ width: '140px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {catExpenses.map(e => (
                                  <tr key={e.id}>
                                    <td className="small text-muted">{new Date(e.date).toLocaleDateString('en-AU')}</td>
                                    <td className="small">{e.description}</td>
                                    {catExpenses.some(ex => ex.owner) && <td className="small text-muted">{e.owner || ''}</td>}
                                    <td className="text-end small fw-bold">${e.amount.toFixed(2)}</td>
                                    <td style={{ width: '160px' }} className="text-nowrap">
                                      <button className="btn btn-xs btn-outline-danger me-1" onClick={(ev) => { ev.stopPropagation(); toggleNonDeductible(e.id); }} title="Mark as non-deductible">
                                        <i className="fa fa-ban"></i>
                                      </button>
                                      {editingExpenseId === e.id ? (
                                        <select className="form-select form-select-sm d-inline-block" style={{ width: '110px' }} autoFocus value={e.category} onChange={ev => updateExpenseCategory(e.id, ev.target.value)} onBlur={() => setEditingExpenseId(null)}>
                                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      ) : (
                                        <button className="btn btn-xs btn-outline-secondary" onClick={(ev) => { ev.stopPropagation(); setEditingExpenseId(e.id); }} title="Change category">
                                          <i className="fa fa-pen-to-square"></i>
                                        </button>
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
                  <div className="border-top pt-2 mt-2 d-flex align-items-center fw-bold">
                    <span className="flex-grow-1">Total Deductions</span>
                    <span>${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </PanelBody>
          </Panel>

          {nonDeductibleExpenses.length > 0 && (
            <Panel>
              <PanelHeader noButton>
                <div className="d-flex align-items-center">
                  <i className="fa fa-ban me-2 text-danger"></i>Non-Deductible
                  <span className="badge bg-danger ms-2">{nonDeductibleExpenses.length}</span>
                  <span className="ms-auto fw-bold">${totalNonDeductible.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
              </PanelHeader>
              <PanelBody>
                <p className="text-muted small mb-2">These expenses are recorded as non-deductible so future imports with the same description are skipped automatically.</p>
                <div>
                  {sortedNonDeductibleCategories.map(([category, total]) => {
                    const pct = totalNonDeductible > 0 ? (total / totalNonDeductible) * 100 : 0;
                    const color = CATEGORY_COLORS[category] || '#6c757d';
                    const isExpanded = expandedNonDeductible.has(category);
                    const catExpenses = sortExpenses(nonDeductibleByCategory[category] || []);
                    return (
                      <div key={category} className="mb-2">
                        <div
                          className="d-flex align-items-center p-2 rounded"
                          style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'var(--bs-light)' : 'transparent' }}
                          onClick={() => toggleNonDeductibleCategory(category)}
                        >
                          <i className={`fa fa-chevron-${isExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '12px', fontSize: '0.7rem' }}></i>
                          <i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'} me-2`} style={{ color }}></i>
                          <span className="fw-bold flex-grow-1">{category}</span>
                          <span className="badge bg-secondary me-2">{catExpenses.length}</span>
                          <span className="fw-bold me-2">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                          <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                        {isExpanded && (
                          <div className="ms-4 mt-1 mb-2 table-responsive">
                            <table className="table table-sm table-hover mb-0">
                              <thead>
                                <tr>
                                  <th style={{ width: '90px' }}>Date</th>
                                  <th>Description</th>
                                  {catExpenses.some(ex => ex.owner) && <th style={{ width: '80px' }}>Owner</th>}
                                  <th className="text-end" style={{ width: '90px' }}>Amount</th>
                                  <th style={{ width: '60px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {catExpenses.map(e => (
                                  <tr key={e.id}>
                                    <td className="small text-muted">{new Date(e.date).toLocaleDateString('en-AU')}</td>
                                    <td className="small">{e.description}</td>
                                    {catExpenses.some(ex => ex.owner) && <td className="small text-muted">{e.owner || ''}</td>}
                                    <td className="text-end small fw-bold">${e.amount.toFixed(2)}</td>
                                    <td>
                                      <button className="btn btn-xs btn-outline-success" onClick={ev => { ev.stopPropagation(); toggleNonDeductible(e.id); }} title="Mark as deductible">
                                        <i className="fa fa-check"></i>
                                      </button>
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
                  <div className="border-top pt-2 mt-2 d-flex align-items-center fw-bold">
                    <span className="flex-grow-1">Total Non-Deductible</span>
                    <span>${totalNonDeductible.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </PanelBody>
            </Panel>
          )}

          {otherExpenses.length > 0 && (
            <Panel>
              <PanelHeader noButton>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span><i className="fa fa-question-circle me-2 text-warning"></i>Uncategorised / Other Deductions</span>
                  <span className="badge bg-warning text-dark">{otherExpenses.length}</span>
                  <button className="btn btn-sm btn-outline-primary ms-sm-auto" onClick={reanalyseOther} disabled={reanalysing}>
                    {reanalysing ? <><i className="fa fa-spinner fa-spin me-1"></i>Re-analysing...</> : <><i className="fa fa-robot me-1"></i>Re-analyse</>}
                  </button>
                </div>
              </PanelHeader>
              <PanelBody>
                <p className="text-muted small mb-2">These expenses are categorised as &quot;Other Deductions&quot;. Re-analyse with AI or manually assign a category to include them in your deductions.</p>
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="sticky-top bg-white">
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="text-end">Amount</th>
                        <th>Move to Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherExpenses.sort((a, b) => b.amount - a.amount).map(e => (
                        <tr key={e.id}>
                          <td className="small text-muted">{new Date(e.date).toLocaleDateString('en-AU')}</td>
                          <td className="small">{e.description}</td>
                          <td className="text-end small fw-bold">${e.amount.toFixed(2)}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value="Other Deductions"
                              onChange={ev => {
                                const v = ev.target.value;
                                if (v === '__non_deductible__') toggleNonDeductible(e.id);
                                else if (v !== 'Other Deductions') updateExpenseCategory(e.id, v);
                              }}
                            >
                              <option value="Other Deductions">— Select —</option>
                              <optgroup label="Deductible">
                                {DEDUCTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </optgroup>
                              <optgroup label="Non-deductible">
                                <option value="__non_deductible__">Mark as Non-deductible</option>
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelBody>
            </Panel>
          )}
      </>}
    </>
  );
}
