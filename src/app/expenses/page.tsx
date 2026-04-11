'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, FamilyMember } from '@/lib/types';

const SPENDING_ICONS: Record<string, string> = {
  'Groceries': 'fa-cart-shopping',
  'Dining & Takeaway': 'fa-utensils',
  'Transport': 'fa-car',
  'Utilities & Bills': 'fa-bolt',
  'Shopping': 'fa-bag-shopping',
  'Healthcare': 'fa-heart-pulse',
  'Entertainment': 'fa-film',
  'Subscriptions': 'fa-repeat',
  'Education': 'fa-graduation-cap',
  'Insurance': 'fa-shield',
  'Home & Garden': 'fa-house',
  'Personal Care': 'fa-spa',
  'Travel & Holidays': 'fa-plane',
  'Gifts & Donations': 'fa-gift',
  'Financial & Banking': 'fa-university',
  'Cafe': 'fa-mug-hot',
  'Bakery': 'fa-bread-slice',
  'Car': 'fa-car-side',
  'Personal Project': 'fa-lightbulb',
  'Kids Entertainment': 'fa-child',
  'Other': 'fa-ellipsis',
};

const SPENDING_COLORS: Record<string, string> = {
  'Groceries': '#20c997',
  'Dining & Takeaway': '#fd7e14',
  'Transport': '#0d6efd',
  'Utilities & Bills': '#ffc107',
  'Shopping': '#e83e8c',
  'Healthcare': '#dc3545',
  'Entertainment': '#6f42c1',
  'Subscriptions': '#6610f2',
  'Education': '#0dcaf0',
  'Insurance': '#198754',
  'Home & Garden': '#795548',
  'Personal Care': '#ff69b4',
  'Travel & Holidays': '#17a2b8',
  'Gifts & Donations': '#e91e63',
  'Financial & Banking': '#607d8b',
  'Cafe': '#8d6e63',
  'Bakery': '#d4a373',
  'Car': '#455a64',
  'Personal Project': '#ff9800',
  'Kids Entertainment': '#4caf50',
  'Other': '#6c757d',
};

const DEFAULT_SPENDING_CATEGORIES = Object.keys(SPENDING_ICONS);

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

type SortField = 'date' | 'description' | 'amount';
type SortDir = 'asc' | 'desc';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [reanalysing, setReanalysing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/expenses?fy=all');
    if (res.ok) setExpenses(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetch('/api/family-members').then(r => r.ok ? r.json() : []).then(setFamilyMembers);
  }, [fetchExpenses]);

  // All spending categories: defaults + custom + any from data
  const allSpendingCategories = [...new Set([
    ...DEFAULT_SPENDING_CATEGORIES,
    ...customCategories,
    ...expenses.map(e => e.spendingCategory).filter(Boolean) as string[],
  ])];

  const addCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name || allSpendingCategories.includes(name)) return;
    setCustomCategories(prev => [...prev, name]);
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const updateExpenseSpendingCategory = async (id: string, spendingCategory: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    // Apply to ALL expenses with the same description
    const matching = expenses.filter(e => e.description === expense.description);
    const updates = matching.map(e =>
      fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id, spendingCategory }),
      })
    );
    await Promise.all(updates);
    setExpenses(prev => prev.map(e => e.description === expense.description ? { ...e, spendingCategory } : e));
    setEditingExpenseId(null);

    // Save rule for future imports
    fetch('/api/category-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: expense.description, spendingCategory }),
    });
  };

  const getExpenseYear = (e: Expense) => e.date ? e.date.substring(0, 4) : '';
  const getExpenseMonthNum = (e: Expense) => e.date ? e.date.substring(5, 7) : '';

  const filteredExpenses = expenses.filter(e => {
    if (selectedOwner && e.owner !== selectedOwner) return false;
    if (selectedYear !== 'all' && getExpenseYear(e) !== selectedYear) return false;
    if (selectedMonth !== 'all' && getExpenseMonthNum(e) !== selectedMonth) return false;
    return true;
  });
  const totalSpend = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Use spendingCategory, fallback to 'Other' if not set
  const getSpendingCat = (e: Expense) => e.spendingCategory || 'Other';

  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    const cat = getSpendingCat(e);
    acc[cat] = (acc[cat] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  const expensesByCategory = filteredExpenses.reduce((acc, e) => {
    const cat = getSpendingCat(e);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {} as Record<string, Expense[]>);

  // Monthly breakdown
  const monthlyTotals = filteredExpenses.reduce((acc, e) => {
    const month = e.date.substring(0, 7);
    acc[month] = (acc[month] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedMonths = Object.entries(monthlyTotals).sort(([a], [b]) => a.localeCompare(b));
  const maxMonthly = Math.max(...Object.values(monthlyTotals), 1);

  const monthlyCategoryTotals = filteredExpenses.reduce((acc, e) => {
    const month = e.date.substring(0, 7);
    const cat = getSpendingCat(e);
    if (!acc[month]) acc[month] = {};
    acc[month][cat] = (acc[month][cat] || 0) + e.amount;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const avgMonthly = sortedMonths.length > 0 ? totalSpend / sortedMonths.length : 0;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
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

  const SortIcon = ({ field }: { field: SortField }) => (
    <i className={`fa fa-sort${sortField === field ? (sortDir === 'asc' ? '-up' : '-down') : ''} ms-1 text-muted`} style={{ fontSize: '0.7rem' }}></i>
  );

  const reanalyse = async () => {
    setReanalysing(true);
    const res = await fetch('/api/expenses/reanalyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financialYear: 'all', type: 'spending' }),
    });
    if (res.ok) await fetchExpenses();
    setReanalysing(false);
  };

  if (loading) {
    return (
      <>
        <h1 className="page-header">Expenses</h1>
        <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      </>
    );
  }

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="page-header mb-0">Expenses</h1>
        <div className="ms-auto d-flex gap-2">
          {familyMembers.length > 0 && (
            <select className="form-select" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}>
              <option value="">All Members</option>
              {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          )}
          <select className="form-select" value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); }}>
            <option value="all">All Years</option>
            {[...new Set(expenses.map(e => getExpenseYear(e)).filter(Boolean))].sort().reverse().map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="form-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="all">All Months</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
              <option key={m} value={m}>{new Date(`2000-${m}-01`).toLocaleDateString('en-AU', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="card border-0 bg-teal text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Total Spend</div>
              <h3 className="text-white mb-0">${totalSpend.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-indigo text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Monthly Average</div>
              <h3 className="text-white mb-0">${avgMonthly.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-dark text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Transactions</div>
              <h3 className="text-white mb-0">{filteredExpenses.length}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-warning text-dark mb-3">
            <div className="card-body">
              <div className="text-dark text-opacity-75 mb-1">Categories</div>
              <h3 className="text-dark mb-0">{sortedCategories.length}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-8">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-list me-2"></i>Expenses by Category
                <div className="ms-auto d-flex gap-2">
                  {showNewCategory ? (
                    <form className="d-flex gap-1" onSubmit={e => { e.preventDefault(); addCustomCategory(); }}>
                      <input type="text" className="form-control form-control-sm" placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus style={{ width: '150px' }} />
                      <button type="submit" className="btn btn-sm btn-success" disabled={!newCategoryName.trim()}><i className="fa fa-check"></i></button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowNewCategory(false)}><i className="fa fa-times"></i></button>
                    </form>
                  ) : (
                    <button className="btn btn-sm btn-outline-success" onClick={() => setShowNewCategory(true)}>
                      <i className="fa fa-plus me-1"></i>Category
                    </button>
                  )}
                  <button className="btn btn-sm btn-outline-primary" onClick={reanalyse} disabled={reanalysing || filteredExpenses.length === 0}>
                    {reanalysing ? <><i className="fa fa-spinner fa-spin me-1"></i>Re-analysing...</> : <><i className="fa fa-robot me-1"></i>Re-analyse</>}
                  </button>
                </div>
              </div>
            </PanelHeader>
            <PanelBody>
              {sortedCategories.length === 0 ? (
                <div className="text-center py-4 text-muted">No expense data yet.</div>
              ) : (
                <div>
                  {sortedCategories.map(([category, total]) => {
                    const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;
                    const color = SPENDING_COLORS[category] || '#6c757d';
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
                          <i className={`fa ${SPENDING_ICONS[category] || 'fa-ellipsis'} me-2`} style={{ color }}></i>
                          <span className="fw-bold flex-grow-1">{category}</span>
                          <span className="badge bg-secondary me-2">{catExpenses.length}</span>
                          <span className="fw-bold me-2">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                          <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                        {isExpanded && (
                          <div className="ms-4 mt-1 mb-2">
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
                                    <td>
                                      {editingExpenseId === e.id ? (
                                        <select className="form-select form-select-sm" autoFocus value={getSpendingCat(e)} onChange={ev => updateExpenseSpendingCategory(e.id, ev.target.value)} onBlur={() => setTimeout(() => setEditingExpenseId(null), 200)}>
                                          {allSpendingCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader noButton>
              <i className="fa fa-chart-bar me-2"></i>Monthly Spending
            </PanelHeader>
            <PanelBody>
              {sortedMonths.length === 0 ? (
                <div className="text-center py-4 text-muted">No expense data yet.</div>
              ) : (
                <div>
                  {sortedMonths.map(([month, total]) => {
                    const date = new Date(month + '-01');
                    const label = date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
                    const pct = (total / maxMonthly) * 100;
                    const cats = monthlyCategoryTotals[month] || {};
                    return (
                      <div key={month} className="mb-3">
                        <div className="d-flex align-items-center mb-1">
                          <span className="small fw-bold" style={{ width: '80px' }}>{label}</span>
                          <span className="flex-grow-1"></span>
                          <span className="small fw-bold">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex" style={{ height: '12px', borderRadius: '4px', overflow: 'hidden' }}>
                          {Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, catTotal]) => (
                            <div
                              key={cat}
                              title={`${cat}: $${catTotal.toFixed(2)}`}
                              style={{
                                width: `${(catTotal / maxMonthly) * 100}%`,
                                backgroundColor: SPENDING_COLORS[cat] || '#6c757d',
                              }}
                            ></div>
                          ))}
                          <div style={{ width: `${100 - pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="col-xl-4">
          <Panel>
            <PanelHeader noButton>
              <i className="fa fa-chart-pie me-2"></i>Spending Breakdown
            </PanelHeader>
            <PanelBody>
              {sortedCategories.length === 0 ? (
                <div className="text-center py-4 text-muted">No expense data yet.</div>
              ) : (
                <div>
                  {sortedCategories.map(([category, total]) => {
                    const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;
                    const color = SPENDING_COLORS[category] || '#6c757d';
                    return (
                      <div key={category} className="mb-3">
                        <div className="d-flex align-items-center mb-1">
                          <i className={`fa ${SPENDING_ICONS[category] || 'fa-ellipsis'} me-2`} style={{ color }}></i>
                          <span className="flex-grow-1 small">{category}</span>
                          <span className="small fw-bold">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                          <span className="small text-muted ms-2" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                        <div className="progress" style={{ height: '6px' }}>
                          <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader noButton>
              <i className="fa fa-calendar me-2"></i>Period Summary
            </PanelHeader>
            <PanelBody>
              <div className="mb-2">
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">Highest Month</span>
                  <span className="fw-bold">
                    {sortedMonths.length > 0 ? (() => {
                      const [month, total] = sortedMonths.reduce(([mM, mT], [m, t]) => t > mT ? [m, t] : [mM, mT]);
                      return `${new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })} — $${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
                    })() : '—'}
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">Lowest Month</span>
                  <span className="fw-bold">
                    {sortedMonths.length > 0 ? (() => {
                      const [month, total] = sortedMonths.reduce(([mM, mT], [m, t]) => t < mT ? [m, t] : [mM, mT]);
                      return `${new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })} — $${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
                    })() : '—'}
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">Avg per Transaction</span>
                  <span className="fw-bold">${filteredExpenses.length > 0 ? (totalSpend / filteredExpenses.length).toFixed(2) : '0.00'}</span>
                </div>
              </div>
              <div className="mb-2">
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">Top Category</span>
                  <span className="fw-bold">{sortedCategories.length > 0 ? sortedCategories[0][0] : '—'}</span>
                </div>
              </div>
              <div>
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">Top Category %</span>
                  <span className="fw-bold">{sortedCategories.length > 0 ? ((sortedCategories[0][1] / totalSpend) * 100).toFixed(1) + '%' : '—'}</span>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
