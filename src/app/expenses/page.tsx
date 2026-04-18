'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, FamilyMember } from '@/lib/types';
import { adviceChatGet, adviceChatPut, reanalyseExpenses, streamExpensesAdvice } from '@/lib/functions-client';
import { listExpenses, updateExpense, addExpenses, deleteExpense } from '@/lib/expenses-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';
import { upsertCategoryRule } from '@/lib/category-rules-repo';
import RecurringModal from '@/components/recurring-modal';
import BulkActionsBar from '@/components/bulk-actions-bar';

const SPENDING_ICONS: Record<string, string> = {
  'Bakery': 'fa-bread-slice',
  'Cafe': 'fa-mug-hot',
  'Car': 'fa-car-side',
  'Dining & Takeaway': 'fa-utensils',
  'Education': 'fa-graduation-cap',
  'Entertainment': 'fa-film',
  'Financial & Banking': 'fa-university',
  'Gifts & Donations': 'fa-gift',
  'Groceries': 'fa-cart-shopping',
  'Healthcare': 'fa-heart-pulse',
  'Home & Garden': 'fa-house',
  'Insurance': 'fa-shield',
  'Kids Entertainment': 'fa-child',
  'Personal Care': 'fa-spa',
  'Personal Project': 'fa-lightbulb',
  'Shopping': 'fa-bag-shopping',
  'Subscriptions': 'fa-repeat',
  'Transport': 'fa-car',
  'Travel & Holidays': 'fa-plane',
  'Utilities & Bills': 'fa-bolt',
  'Other': 'fa-ellipsis',
};

const SPENDING_COLORS: Record<string, string> = {
  'Bakery': '#d4a373',
  'Cafe': '#8d6e63',
  'Car': '#455a64',
  'Dining & Takeaway': '#fd7e14',
  'Education': '#0dcaf0',
  'Entertainment': '#6f42c1',
  'Financial & Banking': '#607d8b',
  'Gifts & Donations': '#e91e63',
  'Groceries': '#20c997',
  'Healthcare': '#dc3545',
  'Home & Garden': '#795548',
  'Insurance': '#198754',
  'Kids Entertainment': '#4caf50',
  'Personal Care': '#ff69b4',
  'Personal Project': '#ff9800',
  'Shopping': '#e83e8c',
  'Subscriptions': '#6610f2',
  'Transport': '#0d6efd',
  'Travel & Holidays': '#17a2b8',
  'Utilities & Bills': '#ffc107',
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
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  const toggleSub = (key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const [reanalysing, setReanalysing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [recurringFor, setRecurringFor] = useState<Expense | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusUncategorised, setFocusUncategorised] = useState(false);
  const [adviceHistory, setAdviceHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [adviceCollapsed, setAdviceCollapsed] = useState(false);
  const adviceAnchorRef = useRef<HTMLDivElement | null>(null);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllInCategory = (expenses: Expense[], checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const e of expenses) {
        if (checked) next.add(e.id); else next.delete(e.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Load custom categories from Firestore
  useEffect(() => {
    adviceChatGet<string>('custom-spending-categories')
      .then(history => { if (history.length) setCustomCategories(history); })
      .catch(() => {});
    adviceChatGet('expenses')
      .then(history => { if (history.length) setAdviceHistory(history as { role: 'user' | 'model'; text: string }[]); })
      .catch(() => {});
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await listExpenses('all'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    listFamilyMembers().then(setFamilyMembers).catch(() => setFamilyMembers([]));
  }, [fetchExpenses]);

  // All spending categories: defaults + custom + any from data
  const allSpendingCategories = [...new Set([
    ...DEFAULT_SPENDING_CATEGORIES,
    ...customCategories,
    ...expenses.map(e => e.spendingCategory).filter(Boolean) as string[],
  ])].sort((a, b) => a.localeCompare(b));

  const addCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (!customCategories.includes(name)) {
      const updated = [...customCategories, name];
      setCustomCategories(updated);
      adviceChatPut<string>('custom-spending-categories', updated).catch(() => {});
    }
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const renameCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setEditingCategoryName(null); return; }

    // Update all expenses with the old category
    const matching = expenses.filter(e => (e.spendingCategory || 'Other') === oldName);
    await Promise.all(matching.map(e => updateExpense(e.id, { spendingCategory: trimmed })));
    setExpenses(prev => prev.map(e => (e.spendingCategory || 'Other') === oldName ? { ...e, spendingCategory: trimmed } : e));

    // Update custom categories list
    if (customCategories.includes(oldName)) {
      const updated = customCategories.map(c => c === oldName ? trimmed : c);
      setCustomCategories(updated);
      adviceChatPut<string>('custom-spending-categories', updated).catch(() => {});
    } else if (!DEFAULT_SPENDING_CATEGORIES.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      adviceChatPut<string>('custom-spending-categories', updated).catch(() => {});
    }

    setEditingCategoryName(null);
  };

  const updateExpenseSpendingCategory = async (id: string, spendingCategory: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    // Apply to ALL expenses with the same description
    const matching = expenses.filter(e => e.description === expense.description);
    await Promise.all(matching.map(e => updateExpense(e.id, { spendingCategory })));
    setExpenses(prev => prev.map(e => e.description === expense.description ? { ...e, spendingCategory } : e));
    setEditingExpenseId(null);

    // Save rule for future imports
    upsertCategoryRule({ pattern: expense.description, spendingCategory }).catch(() => {});
  };

  const bulkChangeCategory = async (spendingCategory: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    await Promise.all(ids.map(id => updateExpense(id, { spendingCategory })));
    setExpenses(prev => prev.map(e => selectedIds.has(e.id) ? { ...e, spendingCategory } : e));
    clearSelection();
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    await Promise.all(ids.map(id => deleteExpense(id)));
    setExpenses(prev => prev.filter(e => !selectedIds.has(e.id)));
    clearSelection();
  };

  const updateExpenseSubCategory = async (id: string, rawValue: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) { setEditingSubCategoryId(null); return; }
    const value = rawValue.trim();
    if (value === (expense.spendingSubCategory || '')) { setEditingSubCategoryId(null); return; }

    const matching = expenses.filter(e => e.description === expense.description);
    await Promise.all(matching.map(e => updateExpense(e.id, { spendingSubCategory: value })));
    setExpenses(prev => prev.map(e => e.description === expense.description ? { ...e, spendingSubCategory: value } : e));
    setEditingSubCategoryId(null);

    upsertCategoryRule({ pattern: expense.description, spendingSubCategory: value }).catch(() => {});
  };

  const getExpenseYear = (e: Expense) => e.date ? e.date.substring(0, 4) : '';
  const getExpenseMonthNum = (e: Expense) => e.date ? e.date.substring(5, 7) : '';

  const hasSubCategory = (e: Expense) => Boolean(e.spendingSubCategory?.trim());

  const baseFilteredExpenses = expenses.filter(e => {
    if (selectedOwner && e.owner !== selectedOwner) return false;
    if (selectedYear !== 'all' && getExpenseYear(e) !== selectedYear) return false;
    if (selectedMonth !== 'all' && getExpenseMonthNum(e) !== selectedMonth) return false;
    return true;
  });
  const uncategorisedCount = baseFilteredExpenses.filter(e => !hasSubCategory(e)).length;
  const filteredExpenses = focusUncategorised
    ? baseFilteredExpenses.filter(e => !hasSubCategory(e))
    : baseFilteredExpenses;
  const totalSpend = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Use spendingCategory, fallback to 'Other' if not set
  const getSpendingCat = (e: Expense) => e.spendingCategory || 'Other';

  const categoryTotals = filteredExpenses.reduce((acc, e) => {
    const cat = getSpendingCat(e);
    acc[cat] = (acc[cat] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([a], [b]) => a.localeCompare(b));

  const NO_SUB = '— No sub-category —';
  const getSub = (e: Expense) => e.spendingSubCategory?.trim() || NO_SUB;

  const expensesByCategory = filteredExpenses.reduce((acc, e) => {
    const cat = getSpendingCat(e);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {} as Record<string, Expense[]>);

  // Group per category into sub-category buckets, plus totals per sub
  const subBucketsByCategory = Object.fromEntries(
    Object.entries(expensesByCategory).map(([cat, items]) => {
      const buckets: Record<string, Expense[]> = {};
      for (const e of items) {
        const s = getSub(e);
        if (!buckets[s]) buckets[s] = [];
        buckets[s].push(e);
      }
      const sorted = Object.entries(buckets).sort(([a], [b]) => {
        if (a === NO_SUB) return 1;
        if (b === NO_SUB) return -1;
        return a.localeCompare(b);
      });
      return [cat, sorted];
    })
  ) as Record<string, [string, Expense[]][]>;

  const subCategoriesByCategory = expenses.reduce((acc, e) => {
    const cat = getSpendingCat(e);
    const sub = e.spendingSubCategory?.trim();
    if (!sub) return acc;
    if (!acc[cat]) acc[cat] = new Set();
    acc[cat].add(sub);
    return acc;
  }, {} as Record<string, Set<string>>);

  const subCatListId = (category: string) => `subcats-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;

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
    try {
      await reanalyseExpenses({ financialYear: 'all', type: 'spending' });
      await fetchExpenses();
    } catch {}
    setReanalysing(false);
  };

  const saveAdviceChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    try { await adviceChatPut('expenses', history); } catch {}
  }, []);

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    setAdviceCollapsed(false);
    let handle;
    try {
      handle = await streamExpensesAdvice({ history, followUp });
    } catch (err) {
      const errorMsg = `Unable to generate advice: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setAdviceHistory([...history, ...(followUp ? [{ role: 'user' as const, text: followUp }] : []), { role: 'model' as const, text: errorMsg }]);
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
    saveAdviceChat(finalHistory);
  };

  const getExpensesAdvice = async () => {
    setAdviceHistory([]);
    setAdviceCollapsed(false);
    adviceAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await streamAdvice([]);
  };

  const sendAdviceFollowUp = async () => {
    const question = followUpInput.trim();
    if (!question || adviceLoading) return;
    setFollowUpInput('');
    const updatedHistory = [...adviceHistory, { role: 'user' as const, text: question }];
    setAdviceHistory(updatedHistory);
    await streamAdvice(updatedHistory.slice(0, -1), question);
  };

  const toggleFocusUncategorised = () => {
    setFocusUncategorised(prev => {
      const next = !prev;
      if (next) {
        const cats = new Set<string>();
        for (const e of baseFilteredExpenses) {
          if (!hasSubCategory(e)) cats.add(getSpendingCat(e));
        }
        setExpandedCategories(cats);
        setExpandedSubs(new Set([...cats].map(c => `${c}::${NO_SUB}`)));
      }
      return next;
    });
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
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="page-header mb-0">Expenses</h1>
        <div className="ms-sm-auto d-flex flex-wrap gap-2">
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

      {selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          categories={allSpendingCategories}
          changeCategoryLabel="Move to"
          onChangeCategory={bulkChangeCategory}
          onDelete={bulkDelete}
          onClear={clearSelection}
        />
      )}

      <div className="row">
        <div className="col-xl-8">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span><i className="fa fa-list me-2"></i>Expenses by Category</span>
                <div className="ms-sm-auto d-flex flex-wrap gap-2">
                  {showNewCategory ? (
                    <div className="d-flex gap-1">
                      <input type="text" className="form-control form-control-sm" placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustomCategory(); }} autoFocus style={{ width: '150px' }} />
                      <button type="button" className="btn btn-sm btn-success" disabled={!newCategoryName.trim()} onClick={addCustomCategory}><i className="fa fa-check"></i></button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowNewCategory(false)}><i className="fa fa-times"></i></button>
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-outline-success" onClick={() => setShowNewCategory(true)}>
                      <i className="fa fa-plus me-1"></i>Category
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${focusUncategorised ? 'btn-warning' : 'btn-outline-warning'}`}
                    onClick={toggleFocusUncategorised}
                    disabled={!focusUncategorised && uncategorisedCount === 0}
                    title="Show only expenses without a sub-category"
                  >
                    <i className="fa fa-filter me-1"></i>
                    {focusUncategorised ? 'Exit Focus' : 'Focus Uncategorised'}
                    {uncategorisedCount > 0 && (
                      <span className={`badge ms-1 ${focusUncategorised ? 'bg-dark text-warning' : 'bg-warning text-dark'}`}>{uncategorisedCount}</span>
                    )}
                  </button>
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
                          {editingCategoryName === category ? (
                            <div className="d-flex gap-1 flex-grow-1 me-2" onClick={ev => ev.stopPropagation()}>
                              <input type="text" className="form-control form-control-sm" value={editCategoryValue} onChange={ev => setEditCategoryValue(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') renameCategory(category, editCategoryValue); if (ev.key === 'Escape') setEditingCategoryName(null); }} autoFocus style={{ maxWidth: '200px' }} />
                              <button className="btn btn-xs btn-success" onClick={() => renameCategory(category, editCategoryValue)}><i className="fa fa-check"></i></button>
                              <button className="btn btn-xs btn-outline-secondary" onClick={() => setEditingCategoryName(null)}><i className="fa fa-times"></i></button>
                            </div>
                          ) : (
                            <span className="fw-bold flex-grow-1">
                              {category}
                              <button className="btn btn-xs btn-link text-muted ms-1 p-0" onClick={ev => { ev.stopPropagation(); setEditingCategoryName(category); setEditCategoryValue(category); }} title="Rename category">
                                <i className="fa fa-pen-to-square" style={{ fontSize: '0.7rem' }}></i>
                              </button>
                            </span>
                          )}
                          <span className="badge bg-secondary me-2">{catExpenses.length}</span>
                          <span className="fw-bold me-2">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                          <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                        {isExpanded && (
                          <div className="ms-4 mt-1 mb-2">
                            <datalist id={subCatListId(category)}>
                              {[...(subCategoriesByCategory[category] || [])].sort().map(sc => <option key={sc} value={sc} />)}
                            </datalist>
                            {(subBucketsByCategory[category] || []).map(([sub, subExpenses]) => {
                              const subKey = `${category}::${sub}`;
                              const subExpanded = expandedSubs.has(subKey);
                              const subTotal = subExpenses.reduce((s, e) => s + e.amount, 0);
                              const subPct = total > 0 ? (subTotal / total) * 100 : 0;
                              const sortedSubExpenses = sortExpenses(subExpenses);
                              const isNoSub = sub === NO_SUB;
                              return (
                                <div key={subKey} className="mb-1">
                                  <div
                                    className="d-flex align-items-center px-2 py-1 rounded"
                                    style={{ cursor: 'pointer', backgroundColor: subExpanded ? 'var(--bs-light)' : 'transparent', fontSize: '0.9rem' }}
                                    onClick={() => toggleSub(subKey)}
                                  >
                                    <i className={`fa fa-chevron-${subExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '10px', fontSize: '0.6rem' }}></i>
                                    <span className={`flex-grow-1 ${isNoSub ? 'fst-italic text-muted' : 'fw-medium'}`}>{sub}</span>
                                    <span className="badge bg-light text-dark border me-2">{subExpenses.length}</span>
                                    <span className="me-2">${subTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                                    <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{subPct.toFixed(1)}%</span>
                                  </div>
                                  {subExpanded && (
                                    <div className="ms-4 mt-1 mb-2 table-responsive">
                                      <table className="table table-sm table-hover mb-0">
                                        <thead>
                                          <tr>
                                            <th style={{ width: '32px' }} onClick={ev => ev.stopPropagation()}>
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={sortedSubExpenses.length > 0 && sortedSubExpenses.every(e => selectedIds.has(e.id))}
                                                ref={el => { if (el) el.indeterminate = sortedSubExpenses.some(e => selectedIds.has(e.id)) && !sortedSubExpenses.every(e => selectedIds.has(e.id)); }}
                                                onChange={ev => selectAllInCategory(sortedSubExpenses, ev.target.checked)}
                                                aria-label={`Select all in ${category} / ${sub}`}
                                              />
                                            </th>
                                            <th style={{ width: '90px', cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); toggleSort('date'); }}>Date<SortIcon field="date" /></th>
                                            <th style={{ cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); toggleSort('description'); }}>Description<SortIcon field="description" /></th>
                                            <th style={{ width: '140px' }}>Sub Category</th>
                                            {sortedSubExpenses.some(e => e.owner) && <th style={{ width: '80px' }}>Owner</th>}
                                            <th className="text-end" style={{ width: '90px', cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); toggleSort('amount'); }}>Amount<SortIcon field="amount" /></th>
                                            <th style={{ width: '60px' }}></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sortedSubExpenses.map(e => (
                                            <tr key={e.id} className={selectedIds.has(e.id) ? 'table-active' : ''}>
                                              <td onClick={ev => ev.stopPropagation()}>
                                                <input
                                                  type="checkbox"
                                                  className="form-check-input"
                                                  checked={selectedIds.has(e.id)}
                                                  onChange={() => toggleSelected(e.id)}
                                                  aria-label={`Select ${e.description}`}
                                                />
                                              </td>
                                              <td className="small text-muted">{new Date(e.date).toLocaleDateString('en-AU')}</td>
                                              <td className="small">{e.description}</td>
                                              <td className="small" onClick={ev => ev.stopPropagation()}>
                                                {editingSubCategoryId === e.id ? (
                                                  <input
                                                    type="text"
                                                    list={subCatListId(category)}
                                                    className="form-control form-control-sm"
                                                    autoFocus
                                                    defaultValue={e.spendingSubCategory || ''}
                                                    onBlur={ev => updateExpenseSubCategory(e.id, ev.target.value)}
                                                    onKeyDown={ev => {
                                                      if (ev.key === 'Enter') updateExpenseSubCategory(e.id, (ev.target as HTMLInputElement).value);
                                                      if (ev.key === 'Escape') setEditingSubCategoryId(null);
                                                    }}
                                                  />
                                                ) : (
                                                  <span role="button" className={e.spendingSubCategory ? '' : 'text-muted'} onClick={() => setEditingSubCategoryId(e.id)}>
                                                    {e.spendingSubCategory || <><i className="fa fa-plus me-1"></i>Add</>}
                                                  </span>
                                                )}
                                              </td>
                                              {sortedSubExpenses.some(ex => ex.owner) && <td className="small text-muted">{e.owner || ''}</td>}
                                              <td className="text-end small fw-bold">
                                                ${e.amount.toFixed(2)}
                                                {e.recurrenceGroupId && <i className="fa fa-repeat ms-1 text-muted" title="Part of a recurring series" style={{ fontSize: '0.7rem' }}></i>}
                                              </td>
                                              <td className="text-nowrap">
                                                <button className="btn btn-xs btn-outline-primary me-1" onClick={(ev) => { ev.stopPropagation(); setRecurringFor(e); }} title="Make recurring">
                                                  <i className="fa fa-repeat"></i>
                                                </button>
                                                {editingExpenseId === e.id ? (
                                                  <select className="form-select form-select-sm d-inline-block" style={{ width: 'auto' }} autoFocus value={getSpendingCat(e)} onChange={ev => updateExpenseSpendingCategory(e.id, ev.target.value)} onBlur={() => setTimeout(() => setEditingExpenseId(null), 200)}>
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
                          {Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catTotal]) => (
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
          <div ref={adviceAnchorRef}></div>
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex flex-wrap align-items-center gap-2">
                {adviceHistory.length > 0 && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setAdviceCollapsed(!adviceCollapsed)} title={adviceCollapsed ? 'Expand' : 'Collapse'}>
                    <i className={`fa fa-chevron-${adviceCollapsed ? 'down' : 'up'}`}></i>
                  </button>
                )}
                <span><i className="fa fa-stethoscope me-2"></i>Expenses Doctor</span>
                <button className="btn btn-sm btn-success ms-sm-auto" onClick={getExpensesAdvice} disabled={adviceLoading || filteredExpenses.length === 0}>
                  {adviceLoading && adviceHistory.length <= 1 ? <><i className="fa fa-spinner fa-spin me-1"></i>Analysing...</> : <><i className="fa fa-robot me-1"></i>{adviceHistory.length > 0 ? 'New Assessment' : 'Get AI Advice'}</>}
                </button>
              </div>
            </PanelHeader>
            {!adviceCollapsed && <PanelBody>
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
                    <form onSubmit={(e) => { e.preventDefault(); sendAdviceFollowUp(); }} className="mt-3 border-top pt-3">
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
                  <p className="mb-0">Click &quot;Get AI Advice&quot; for a cashflow health assessment and a ranked list of expenses worth dropping.</p>
                </div>
              )}
            </PanelBody>}
          </Panel>

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
                  <span className="fw-bold">{(() => { const top = sortedCategories.length > 0 ? [...sortedCategories].sort(([, a], [, b]) => b - a)[0] : null; return top ? top[0] : '—'; })()}</span>
                </div>
              </div>
              <div>
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">Top Category %</span>
                  <span className="fw-bold">{(() => { const top = sortedCategories.length > 0 ? [...sortedCategories].sort(([, a], [, b]) => b - a)[0] : null; return top ? ((top[1] / totalSpend) * 100).toFixed(1) + '%' : '—'; })()}</span>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>

      {recurringFor && (
        <RecurringModal
          expense={recurringFor}
          onClose={() => setRecurringFor(null)}
          onConfirm={async (items) => {
            const saved = await addExpenses(items);
            setExpenses(prev => [...prev, ...saved]);
          }}
        />
      )}
    </>
  );
}
