'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense } from '@/lib/types';

const CATEGORIES = [
  'Work from Home',
  'Vehicle & Travel',
  'Clothing & Laundry',
  'Self-Education',
  'Tools & Equipment',
  'Professional Memberships',
  'Phone & Internet',
  'Donations',
  'Investment Expenses',
  'Other Deductions',
];

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

export default function TaxPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', description: '', amount: '', category: CATEGORIES[0] });
  const [financialYear, setFinancialYear] = useState('2025-2026');
  const [adviceHistory, setAdviceHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [adviceCollapsed, setAdviceCollapsed] = useState(false);

  const adviceHistoryRef = useRef(adviceHistory);
  adviceHistoryRef.current = adviceHistory;

  const saveChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    await fetch('/api/advice-chat', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tax', history }),
    });
  }, []);

  useEffect(() => {
    fetch('/api/advice-chat?type=tax')
      .then(res => res.ok ? res.json() : { history: [] })
      .then(data => { if (data.history?.length) setAdviceHistory(data.history); });
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/expenses?fy=${financialYear}`);
    if (res.ok) setExpenses(await res.json());
    setLoading(false);
  }, [financialYear]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        financialYear,
      }),
    });
    if (res.ok) {
      const expense = await res.json();
      setExpenses(prev => [expense, ...prev]);
      setForm({ date: '', description: '', amount: '', category: CATEGORIES[0] });
      setShowForm(false);
    }
    setSaving(false);
  };

  const removeExpense = async (id: string) => {
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    const res = await fetch('/api/tax/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financialYear, history, followUp }),
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      const errorMsg = `Unable to generate advice: ${errText || res.statusText}`;
      const updated = [...history, ...(followUp ? [{ role: 'user' as const, text: followUp }] : []), { role: 'model' as const, text: errorMsg }];
      setAdviceHistory(updated);
      setAdviceLoading(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    setAdviceHistory(prev => [...prev, { role: 'model', text: '' }]);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      setAdviceHistory(prev => [...prev.slice(0, -1), { role: 'model', text }]);
    }
    setAdviceLoading(false);
    // Persist the full conversation after stream completes
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

  const totalDeductions = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="page-header mb-0">Tax Health Check</h1>
        <div className="ms-auto">
          <select className="form-select" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
            <option value="2025-2026">FY 2025-2026</option>
            <option value="2024-2025">FY 2024-2025</option>
            <option value="2023-2024">FY 2023-2024</option>
          </select>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-lg-4">
          <div className="card border-0 bg-teal text-white mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div>
                  <div className="text-white text-opacity-75 mb-1">Total Deductions</div>
                  <h2 className="text-white mb-0">${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h2>
                </div>
                <div className="ms-auto"><i className="fa fa-receipt fa-3x text-white text-opacity-25"></i></div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 bg-indigo text-white mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div>
                  <div className="text-white text-opacity-75 mb-1">Categories Used</div>
                  <h2 className="text-white mb-0">{Object.keys(categoryTotals).length} / {CATEGORIES.length}</h2>
                </div>
                <div className="ms-auto"><i className="fa fa-layer-group fa-3x text-white text-opacity-25"></i></div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 bg-dark text-white mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div>
                  <div className="text-white text-opacity-75 mb-1">Expenses Logged</div>
                  <h2 className="text-white mb-0">{expenses.length}</h2>
                </div>
                <div className="ms-auto"><i className="fa fa-file-alt fa-3x text-white text-opacity-25"></i></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-8">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                Expenses
                <button className="btn btn-success btn-sm ms-auto" onClick={() => setShowForm(!showForm)}>
                  <i className="fa fa-plus me-1"></i> Add Expense
                </button>
              </div>
            </PanelHeader>
            <PanelBody>
              {showForm && (
                <form onSubmit={addExpense} className="row g-2 mb-3 p-3 bg-light rounded">
                  <div className="col-md-2">
                    <input type="date" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="col-md-3">
                    <input type="text" className="form-control" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                  </div>
                  <div className="col-md-2">
                    <input type="number" className="form-control" placeholder="Amount" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  </div>
                  <div className="col-md-3">
                    <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <button type="submit" className="btn btn-success w-100" disabled={saving}>
                      {saving ? <i className="fa fa-spinner fa-spin"></i> : 'Add'}
                    </button>
                  </div>
                </form>
              )}

              {loading ? (
                <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa fa-file-invoice-dollar fa-3x mb-3 d-block"></i>
                  <p>No expenses yet. Add your first expense to get started.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th className="text-end">Amount</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(expense => (
                        <tr key={expense.id}>
                          <td>{new Date(expense.date).toLocaleDateString('en-AU')}</td>
                          <td>{expense.description}</td>
                          <td>
                            <span className="badge bg-secondary">
                              <i className={`fa ${CATEGORY_ICONS[expense.category] || 'fa-receipt'} me-1`}></i>
                              {expense.category}
                            </span>
                          </td>
                          <td className="text-end">${expense.amount.toFixed(2)}</td>
                          <td>
                            <button className="btn btn-xs btn-danger" onClick={() => removeExpense(expense.id)}>
                              <i className="fa fa-times"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="fw-bold">
                        <td colSpan={3}>Total</td>
                        <td className="text-end">${totalDeductions.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="col-xl-4">
          <Panel>
            <PanelHeader noButton>Deductions by Category</PanelHeader>
            <PanelBody>
              {sortedCategories.length === 0 ? (
                <div className="text-center py-4 text-muted"><p className="mb-0">Add expenses to see the breakdown</p></div>
              ) : (
                <div>
                  {sortedCategories.map(([category, total]) => (
                    <div key={category} className="mb-3">
                      <div className="d-flex align-items-center mb-1">
                        <i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'} me-2 text-muted`}></i>
                        <span className="flex-grow-1">{category}</span>
                        <span className="fw-bold">${total.toFixed(2)}</span>
                      </div>
                      <div className="progress" style={{ height: '4px' }}>
                        <div className="progress-bar bg-teal" style={{ width: `${(total / totalDeductions) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          {expenses.length > 0 && (
            <Panel>
              <PanelHeader noButton>
                <div className="d-flex align-items-center">
                  {adviceHistory.length > 0 && (
                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => setAdviceCollapsed(!adviceCollapsed)} title={adviceCollapsed ? 'Expand' : 'Collapse'}>
                      <i className={`fa fa-chevron-${adviceCollapsed ? 'down' : 'up'}`}></i>
                    </button>
                  )}
                  <i className="fa fa-stethoscope me-2"></i>Tax Health Assessment
                  <button className="btn btn-sm btn-success ms-auto" onClick={getAdvice} disabled={adviceLoading}>
                    {adviceLoading && adviceHistory.length <= 1 ? <><i className="fa fa-spinner fa-spin me-1"></i>Analysing...</> : <><i className="fa fa-robot me-1"></i>{adviceHistory.length > 0 ? 'New Assessment' : 'Get AI Advice'}</>}
                  </button>
                </div>
              </PanelHeader>
              {!adviceCollapsed && <PanelBody>
                {adviceHistory.length > 0 ? (
                  <>
                    {adviceHistory.map((msg, i) => (
                      <div key={i} className={msg.role === 'user' ? 'mb-3' : 'mb-3'}>
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
              </PanelBody>}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
