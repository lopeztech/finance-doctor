'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, FamilyMember } from '@/lib/types';

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
  'Other Deductions': '#6c757d',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState('2025-2026');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [reanalysing, setReanalysing] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/expenses?fy=${financialYear}`);
    if (res.ok) setExpenses(await res.json());
    setLoading(false);
  }, [financialYear]);

  useEffect(() => {
    fetchExpenses();
    fetch('/api/family-members').then(r => r.ok ? r.json() : []).then(setFamilyMembers);
  }, [fetchExpenses]);

  const filteredExpenses = selectedOwner ? expenses.filter(e => e.owner === selectedOwner) : expenses;
  const totalSpend = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  // Group expenses by category
  const expensesByCategory = filteredExpenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
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
    if (!acc[month]) acc[month] = {};
    acc[month][e.category] = (acc[month][e.category] || 0) + e.amount;
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

  const reanalyse = async () => {
    setReanalysing(true);
    const res = await fetch('/api/expenses/reanalyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financialYear }),
    });
    if (res.ok) {
      await fetchExpenses();
    }
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
          <select className="form-select" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
            <option value="2025-2026">FY 2025-2026</option>
            <option value="2024-2025">FY 2024-2025</option>
            <option value="2023-2024">FY 2023-2024</option>
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
                <button className="btn btn-sm btn-outline-primary ms-auto" onClick={reanalyse} disabled={reanalysing || filteredExpenses.length === 0}>
                  {reanalysing ? <><i className="fa fa-spinner fa-spin me-1"></i>Re-analysing...</> : <><i className="fa fa-robot me-1"></i>Re-analyse</>}
                </button>
              </div>
            </PanelHeader>
            <PanelBody>
              {sortedCategories.length === 0 ? (
                <div className="text-center py-4 text-muted">No expense data yet.</div>
              ) : (
                <div>
                  {sortedCategories.map(([category, total]) => {
                    const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;
                    const color = CATEGORY_COLORS[category] || '#6c757d';
                    const isExpanded = expandedCategories.has(category);
                    const categoryExpenses = (expensesByCategory[category] || []).sort((a, b) => b.amount - a.amount);
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
                          <span className="badge bg-secondary me-2">{categoryExpenses.length}</span>
                          <span className="fw-bold me-2">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                          <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                        {isExpanded && (
                          <div className="ms-4 mt-1 mb-2">
                            <table className="table table-sm table-hover mb-0">
                              <tbody>
                                {categoryExpenses.map(e => (
                                  <tr key={e.id}>
                                    <td className="small text-muted" style={{ width: '90px' }}>{new Date(e.date).toLocaleDateString('en-AU')}</td>
                                    <td className="small">{e.description}</td>
                                    {e.owner && <td className="small text-muted" style={{ width: '80px' }}>{e.owner}</td>}
                                    <td className="text-end small fw-bold" style={{ width: '90px' }}>${e.amount.toFixed(2)}</td>
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
                                backgroundColor: CATEGORY_COLORS[cat] || '#6c757d',
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
                    const color = CATEGORY_COLORS[category] || '#6c757d';
                    return (
                      <div key={category} className="mb-3">
                        <div className="d-flex align-items-center mb-1">
                          <i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'} me-2`} style={{ color }}></i>
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
