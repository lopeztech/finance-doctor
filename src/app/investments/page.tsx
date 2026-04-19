'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Investment, FamilyMember, Expense } from '@/lib/types';
import { adviceChatGet, adviceChatPut, streamInvestmentsAdvice } from '@/lib/functions-client';
import { listInvestments, addInvestment, updateInvestment, deleteInvestment } from '@/lib/investments-repo';
import { listExpenses, updateExpense } from '@/lib/expenses-repo';
import AllocationChart from '@/components/allocation-chart';
import { CostVsValueChart, GainLossChart, OwnerAllocationChart, ReturnByTypeChart } from '@/components/investment-charts';
import { listFamilyMembers } from '@/lib/family-members-repo';
import { getCategorySettings, resolveType, type CategorySettings, type SpendingCategoryType } from '@/lib/category-settings-repo';
import { ViewToggle, useViewMode } from '@/components/view-toggle';

const SPENDING_ICONS: Record<string, string> = {
  'Bakery': 'fa-bread-slice', 'Cafe': 'fa-mug-hot', 'Car': 'fa-car-side',
  'Dining & Takeaway': 'fa-utensils', 'Education': 'fa-graduation-cap', 'Entertainment': 'fa-film',
  'Financial & Banking': 'fa-university', 'Gifts & Donations': 'fa-gift', 'Groceries': 'fa-cart-shopping',
  'Healthcare': 'fa-heart-pulse', 'Home & Garden': 'fa-house', 'Insurance': 'fa-shield',
  'Kids Entertainment': 'fa-child', 'Personal Care': 'fa-spa', 'Personal Project': 'fa-lightbulb',
  'Shopping': 'fa-bag-shopping', 'Subscriptions': 'fa-repeat', 'Transport': 'fa-car',
  'Travel & Holidays': 'fa-plane', 'Utilities & Bills': 'fa-bolt', 'Other': 'fa-ellipsis',
};

const SPENDING_COLORS: Record<string, string> = {
  'Bakery': '#d4a373', 'Cafe': '#8d6e63', 'Car': '#455a64',
  'Dining & Takeaway': '#fd7e14', 'Education': '#0dcaf0', 'Entertainment': '#6f42c1',
  'Financial & Banking': '#607d8b', 'Gifts & Donations': '#e91e63', 'Groceries': '#20c997',
  'Healthcare': '#dc3545', 'Home & Garden': '#795548', 'Insurance': '#198754',
  'Kids Entertainment': '#4caf50', 'Personal Care': '#ff69b4', 'Personal Project': '#ff9800',
  'Shopping': '#e83e8c', 'Subscriptions': '#6610f2', 'Transport': '#0d6efd',
  'Travel & Holidays': '#17a2b8', 'Utilities & Bills': '#ffc107', 'Other': '#6c757d',
};

const INV_TYPE_BADGES: Record<SpendingCategoryType, string> = {
  essential: 'bg-success',
  committed: 'bg-warning',
  discretionary: 'bg-danger',
};
const INV_TYPE_LABELS: Record<SpendingCategoryType, string> = {
  essential: 'Essential',
  committed: 'Committed',
  discretionary: 'Discretionary',
};

const NO_SUB = '— No sub-category —';
const UNASSIGNED_KEY = '__unassigned__';

const INVESTMENT_TYPES = [
  'Australian Shares',
  'International Shares',
  'ETFs',
  'Property',
  'Cryptocurrency',
  'Cash / Term Deposit',
  'Bonds',
  'Superannuation',
  'Other',
];

const TRADED_TYPES = ['Australian Shares', 'International Shares', 'ETFs', 'Cryptocurrency'];

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

const NAME_PLACEHOLDERS: Record<string, string> = {
  'Australian Shares': 'e.g. CBA, BHP',
  'International Shares': 'e.g. AAPL, MSFT',
  'ETFs': 'e.g. VAS, VGS, VDHG',
  'Bonds': 'e.g. Aus Gov 2030',
  'Property': 'e.g. 42 Smith St, Brisbane',
  'Cryptocurrency': 'e.g. BTC, ETH',
  'Cash / Term Deposit': 'e.g. ING Savings, CBA TD',
  'Superannuation': 'e.g. AustralianSuper',
  'Other': 'Description',
};

interface FormState {
  name: string;
  type: string;
  owner: string;
  // Traded assets
  units: string;
  buyPricePerUnit: string;
  currentValue: string;
  // Property
  propertyType: string;
  purchasePrice: string;
  address: string;
  rentalIncomeMonthly: string;
  liability: string;
  monthlyRepayment: string;
  // Cash
  amount: string;
  interestRate: string;
  // Bonds
  faceValue: string;
  couponRate: string;
  maturityDate: string;
  // Super
  balance: string;
  employerContribution: string;
}

const EMPTY_FORM: FormState = {
  name: '', type: INVESTMENT_TYPES[0], owner: '',
  units: '', buyPricePerUnit: '', currentValue: '',
  propertyType: 'Investment', purchasePrice: '', address: '', rentalIncomeMonthly: '', liability: '', monthlyRepayment: '',
  amount: '', interestRate: '',
  faceValue: '', couponRate: '', maturityDate: '',
  balance: '', employerContribution: '',
};

function buildInvestment(form: FormState): Investment {
  const base = { id: crypto.randomUUID(), name: form.name, type: form.type, ...(form.owner ? { owner: form.owner } : {}) };

  if (TRADED_TYPES.includes(form.type)) {
    const units = parseFloat(form.units);
    const buyPrice = parseFloat(form.buyPricePerUnit);
    return { ...base, units, buyPricePerUnit: buyPrice, costBasis: units * buyPrice, currentValue: parseFloat(form.currentValue) };
  }
  if (form.type === 'Property') {
    const pp = parseFloat(form.purchasePrice);
    const rate = parseFloat(form.interestRate);
    const repayment = parseFloat(form.monthlyRepayment);
    const address = form.address.trim();
    return {
      ...base,
      propertyType: form.propertyType as 'Investment' | 'Owner Occupied',
      costBasis: pp,
      currentValue: parseFloat(form.currentValue),
      rentalIncomeMonthly: parseFloat(form.rentalIncomeMonthly) || 0,
      liability: parseFloat(form.liability) || 0,
      ...(address ? { address } : {}),
      ...(Number.isFinite(rate) && rate > 0 ? { interestRate: rate } : {}),
      ...(Number.isFinite(repayment) && repayment > 0 ? { monthlyRepayment: repayment } : {}),
    };
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
  // Other
  return { ...base, costBasis: parseFloat(form.purchasePrice) || 0, currentValue: parseFloat(form.currentValue) };
}

function CurrencyInput({ placeholder, value, onChange, required = false, step = '0.01' }: { placeholder: string; value: string; onChange: (v: string) => void; required?: boolean; step?: string }) {
  return (
    <div className="input-group">
      <span className="input-group-text">$</span>
      <input type="number" className="form-control" placeholder={placeholder} step={step} min="0" value={value} onChange={e => onChange(e.target.value)} required={required} />
    </div>
  );
}

function PercentInput({ placeholder, value, onChange, step = '0.01' }: { placeholder: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="input-group">
      <input type="number" className="form-control" placeholder={placeholder} step={step} min="0" value={value} onChange={e => onChange(e.target.value)} />
      <span className="input-group-text">%</span>
    </div>
  );
}

function TypeSpecificFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { type } = form;

  if (TRADED_TYPES.includes(type)) {
    return (
      <>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Units</label>
          <input type="number" className="form-control" placeholder="e.g. 100" step="any" min="0" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} required />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Buy price per unit</label>
          <CurrencyInput placeholder="0.00" value={form.buyPricePerUnit} onChange={v => setForm({ ...form, buyPricePerUnit: v })} required />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Current total value</label>
          <CurrencyInput placeholder="0.00" value={form.currentValue} onChange={v => setForm({ ...form, currentValue: v })} required />
        </div>
      </>
    );
  }

  if (type === 'Property') {
    return (
      <>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Property type</label>
          <select className="form-select" value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })}>
            <option value="Investment">Investment</option>
            <option value="Owner Occupied">Owner / Occupied</option>
          </select>
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Address</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. 42 Moreland St, Brunswick VIC 3056"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
          />
          <div className="form-text small">Helps Dr Finance tailor advice to the local market (optional).</div>
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Purchase price</label>
          <CurrencyInput placeholder="0.00" value={form.purchasePrice} onChange={v => setForm({ ...form, purchasePrice: v })} required step="1" />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Current value</label>
          <CurrencyInput placeholder="0.00" value={form.currentValue} onChange={v => setForm({ ...form, currentValue: v })} required step="1" />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Mortgage / liability</label>
          <CurrencyInput placeholder="0.00" value={form.liability} onChange={v => setForm({ ...form, liability: v })} step="1" />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Interest rate</label>
          <PercentInput placeholder="0.00" value={form.interestRate} onChange={v => setForm({ ...form, interestRate: v })} />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Monthly repayment (P&amp;I)</label>
          <CurrencyInput placeholder="0.00" value={form.monthlyRepayment} onChange={v => setForm({ ...form, monthlyRepayment: v })} step="1" />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Rental income per month</label>
          <CurrencyInput placeholder="0.00" value={form.rentalIncomeMonthly} onChange={v => setForm({ ...form, rentalIncomeMonthly: v })} step="1" />
        </div>
      </>
    );
  }

  if (type === 'Cash / Term Deposit') {
    return (
      <>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Amount</label>
          <CurrencyInput placeholder="0.00" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Interest rate</label>
          <PercentInput placeholder="0.00" value={form.interestRate} onChange={v => setForm({ ...form, interestRate: v })} />
        </div>
      </>
    );
  }

  if (type === 'Bonds') {
    return (
      <>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Face value</label>
          <CurrencyInput placeholder="0.00" value={form.faceValue} onChange={v => setForm({ ...form, faceValue: v })} required />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Coupon rate</label>
          <PercentInput placeholder="0.00" value={form.couponRate} onChange={v => setForm({ ...form, couponRate: v })} />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Maturity date</label>
          <input type="date" className="form-control" value={form.maturityDate} onChange={e => setForm({ ...form, maturityDate: e.target.value })} />
        </div>
      </>
    );
  }

  if (type === 'Superannuation') {
    return (
      <>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Current balance</label>
          <CurrencyInput placeholder="0.00" value={form.balance} onChange={v => setForm({ ...form, balance: v })} required />
        </div>
        <div className="col-12">
          <label className="form-label text-muted small mb-1">Employer contribution</label>
          <PercentInput placeholder="0.0" value={form.employerContribution} onChange={v => setForm({ ...form, employerContribution: v })} step="0.5" />
        </div>
      </>
    );
  }

  // Other
  return (
    <>
      <div className="col-12">
        <label className="form-label text-muted small mb-1">Purchase price</label>
        <CurrencyInput placeholder="0.00" value={form.purchasePrice} onChange={v => setForm({ ...form, purchasePrice: v })} required />
      </div>
      <div className="col-12">
        <label className="form-label text-muted small mb-1">Current value</label>
        <CurrencyInput placeholder="0.00" value={form.currentValue} onChange={v => setForm({ ...form, currentValue: v })} required />
      </div>
    </>
  );
}

function getMarginalRate(salary: number): number {
  if (salary <= 18200) return 0;
  if (salary <= 45000) return 0.16;
  if (salary <= 135000) return 0.30;
  if (salary <= 190000) return 0.37;
  return 0.45;
}

function estimateCgt(inv: Investment, familyMembers: FamilyMember[]): { amount: number; label: string } | null {
  // Owner Occupied properties are CGT exempt
  if (inv.type === 'Property' && inv.propertyType === 'Owner Occupied') {
    return { amount: 0, label: 'Exempt' };
  }

  const gain = inv.currentValue - inv.costBasis;
  if (gain <= 0) return { amount: 0, label: '$0.00' };

  // 50% CGT discount (assuming held >12 months)
  const discountedGain = gain * 0.5;

  if (!inv.owner || inv.owner === 'Unassigned') {
    return null; // Can't calculate without an owner
  }

  if (inv.owner === 'Joint') {
    // Split evenly, each member gets 50% of the discounted gain
    if (familyMembers.length < 2) return null;
    const perPerson = discountedGain / 2;
    // Use the two highest-salary members as a proxy
    const sorted = [...familyMembers].sort((a, b) => b.salary - a.salary);
    const rate1 = getMarginalRate(sorted[0].salary) + 0.02; // +Medicare Levy
    const rate2 = getMarginalRate(sorted[1].salary) + 0.02;
    const cgt = perPerson * rate1 + perPerson * rate2;
    return { amount: cgt, label: `$${cgt.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` };
  }

  const member = familyMembers.find(m => m.name === inv.owner);
  if (!member) return null;

  const rate = getMarginalRate(member.salary) + 0.02; // +Medicare Levy
  const cgt = discountedGain * rate;
  return { amount: cgt, label: `$${cgt.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` };
}

function formatDetail(inv: Investment): string {
  if (TRADED_TYPES.includes(inv.type) && inv.units) return `${inv.units} units @ $${inv.buyPricePerUnit?.toFixed(2)}`;
  if (inv.type === 'Property') {
    const parts: string[] = [inv.propertyType || 'Investment'];
    if (inv.address) parts.push(inv.address);
    if (inv.liability) parts.push(`Mortgage: $${inv.liability.toLocaleString()}`);
    if (inv.rentalIncomeMonthly) parts.push(`Rental: $${Math.round(inv.rentalIncomeMonthly).toLocaleString()}/mo`);
    return parts.join(' | ');
  }
  if (inv.type === 'Cash / Term Deposit' && inv.interestRate) return `${inv.interestRate}% p.a.`;
  if (inv.type === 'Bonds' && inv.couponRate) return `${inv.couponRate}% coupon`;
  if (inv.type === 'Superannuation' && inv.employerContribution) return `${inv.employerContribution}% employer`;
  return '';
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
  const [adviceCollapsed, setAdviceCollapsed] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [investmentRelatedExpenses, setInvestmentRelatedExpenses] = useState<Expense[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySettings>({ types: {}, excluded: [] });
  const [expandedInvestmentIds, setExpandedInvestmentIds] = useState<Set<string>>(new Set());
  const [expandedInvCategories, setExpandedInvCategories] = useState<Set<string>>(new Set());
  const [expandedInvSubs, setExpandedInvSubs] = useState<Set<string>>(new Set());
  const [mode, setMode] = useViewMode('viewMode.investments');

  const toggleInvestmentExpanded = (key: string) => {
    setExpandedInvestmentIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleInvCategoryExpanded = (key: string) => {
    setExpandedInvCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleInvSubExpanded = (key: string) => {
    setExpandedInvSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const adviceHistoryRef = useRef(adviceHistory);
  adviceHistoryRef.current = adviceHistory;

  const saveChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    try { await adviceChatPut('investments', history); } catch {}
  }, []);

  useEffect(() => {
    adviceChatGet('investments')
      .then(history => { if (history.length) setAdviceHistory(history); })
      .catch(() => {});
    getCategorySettings().then(setCategorySettings).catch(() => {});
  }, []);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try {
      setInvestments(await listInvestments());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFamilyMembers = useCallback(async () => {
    try {
      setFamilyMembers(await listFamilyMembers());
    } catch {
      setFamilyMembers([]);
    }
  }, []);

  const fetchInvestmentExpenses = useCallback(async () => {
    try {
      const all = await listExpenses('all');
      setInvestmentRelatedExpenses(all.filter(e => e.category === 'Investment Expenses' || e.category === 'Investment Property'));
    } catch {
      setInvestmentRelatedExpenses([]);
    }
  }, []);

  useEffect(() => { fetchInvestments(); fetchFamilyMembers(); fetchInvestmentExpenses(); }, [fetchInvestments, fetchFamilyMembers, fetchInvestmentExpenses]);

  const assignExpenseToInvestment = async (expenseId: string, investmentId: string | null) => {
    await updateExpense(expenseId, investmentId ? { investmentId } : { investmentId: undefined });
    setInvestmentRelatedExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, investmentId: investmentId || undefined } : e));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const inv = buildInvestment(form);

    const { id: _unusedId, ...data } = inv;
    if (editingId) {
      await updateInvestment(editingId, data);
      setInvestments(prev => prev.map(i => i.id === editingId ? { id: editingId, ...data } : i));
    } else {
      const saved = await addInvestment(data);
      setInvestments(prev => [...prev, saved]);
    }
    cancelEdit();
    setSaving(false);
  };

  const startEdit = (inv: Investment) => {
    const f: FormState = { ...EMPTY_FORM, name: inv.name, type: inv.type, owner: inv.owner || '' };
    if (TRADED_TYPES.includes(inv.type)) {
      f.units = String(inv.units || '');
      f.buyPricePerUnit = String(inv.buyPricePerUnit || '');
      f.currentValue = String(inv.currentValue);
    } else if (inv.type === 'Property') {
      f.propertyType = inv.propertyType || 'Investment';
      f.address = inv.address || '';
      f.purchasePrice = String(inv.costBasis);
      f.currentValue = String(inv.currentValue);
      f.liability = String(inv.liability || '');
      f.rentalIncomeMonthly = inv.rentalIncomeMonthly ? String(inv.rentalIncomeMonthly) : '';
      f.interestRate = String(inv.interestRate || '');
      f.monthlyRepayment = String(inv.monthlyRepayment || '');
    } else if (inv.type === 'Cash / Term Deposit') {
      f.amount = String(inv.currentValue);
      f.interestRate = String(inv.interestRate || '');
    } else if (inv.type === 'Bonds') {
      f.faceValue = String(inv.costBasis);
      f.couponRate = String(inv.couponRate || '');
      f.maturityDate = inv.maturityDate || '';
    } else if (inv.type === 'Superannuation') {
      f.balance = String(inv.currentValue);
      f.employerContribution = String(inv.employerContribution || '');
    } else {
      f.purchasePrice = String(inv.costBasis);
      f.currentValue = String(inv.currentValue);
    }
    setForm(f);
    setEditingId(inv.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const removeInvestment = async (id: string) => {
    await deleteInvestment(id);
    setInvestments(prev => prev.filter(i => i.id !== id));
  };

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    let handle;
    try {
      handle = await streamInvestmentsAdvice({ history, followUp });
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

  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const totalLiability = investments.reduce((sum, i) => sum + (i.type === 'Property' && i.liability ? i.liability : 0), 0);
  const totalGainLoss = investments.reduce((sum, i) => {
    return sum + (i.liability ? i.currentValue - i.liability : i.currentValue - i.costBasis);
  }, 0);
  const totalReturnPct = totalCost > 0 ? ((totalGainLoss / totalCost) * 100) : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue;
    return acc;
  }, {} as Record<string, number>);

  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

  const costVsValueByType = investments.reduce((acc, i) => {
    if (!acc[i.type]) acc[i.type] = { cost: 0, value: 0 };
    acc[i.type].cost += i.costBasis;
    acc[i.type].value += i.currentValue;
    return acc;
  }, {} as Record<string, { cost: number; value: number }>);

  const gainLossItems = investments.map(i => {
    const gl = i.liability ? i.currentValue - i.liability : i.currentValue - i.costBasis;
    const base = i.liability ? i.liability : i.costBasis;
    const pct = base > 0 ? (gl / base) * 100 : 0;
    return { name: i.name, type: i.type, gainLoss: gl, returnPct: pct };
  }).filter(i => i.gainLoss !== 0);

  const allocationByOwner = investments.reduce((acc, i) => {
    const key = i.owner || 'Unassigned';
    acc[key] = (acc[key] || 0) + i.currentValue;
    return acc;
  }, {} as Record<string, number>);
  const ownerCount = Object.keys(allocationByOwner).length;

  const typeCount = Object.keys(allocationByType).length;
  const maxAllocationPct = totalValue > 0
    ? Math.max(...Object.values(allocationByType).map(v => (v / totalValue) * 100))
    : 0;

  const getHealthRating = () => {
    if (investments.length === 0) return null;
    let score = 0;
    if (typeCount >= 4) score += 2;
    else if (typeCount >= 2) score += 1;
    if (maxAllocationPct < 40) score += 2;
    else if (maxAllocationPct < 60) score += 1;
    if (allocationByType['Superannuation']) score += 1;
    if (score >= 4) return { label: 'Healthy', color: 'success', icon: 'fa-heart' };
    if (score >= 2) return { label: 'Fair', color: 'warning', icon: 'fa-heart-crack' };
    return { label: 'Needs Attention', color: 'danger', icon: 'fa-heart-pulse' };
  };

  const health = getHealthRating();

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="page-header mb-0">Investment Portfolio</h1>
        <ViewToggle value={mode} onChange={setMode} className="ms-sm-auto" />
      </div>

      {mode === 'summary' && <>
      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="card border-0 bg-teal text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Portfolio Value</div>
              <h3 className="text-white mb-0">${totalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-danger text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Total Liability</div>
              <h3 className="text-white mb-0">${totalLiability.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
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
          <div className={`card border-0 ${health ? `bg-${health.color}` : 'bg-dark'} text-white mb-3`}>
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Portfolio Health</div>
              <h3 className="text-white mb-0">
                {health ? (
                  <><i className={`fa ${health.icon} me-2`}></i>{health.label}</>
                ) : '---'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {sortedAllocations.length > 0 && (
        <div className="row">
          <div className={ownerCount > 1 ? 'col-xl-6' : 'col-12'}>
            <Panel className="mb-3">
              <PanelHeader noButton>
                <div className="d-flex align-items-center">
                  <i className="fa fa-chart-pie me-2"></i>Asset Allocation by Type
                </div>
              </PanelHeader>
              <PanelBody>
                <AllocationChart allocations={sortedAllocations} height={320} />
              </PanelBody>
            </Panel>
          </div>
          {ownerCount > 1 && (
            <div className="col-xl-6">
              <Panel className="mb-3">
                <PanelHeader noButton>
                  <div className="d-flex align-items-center">
                    <i className="fa fa-users me-2"></i>Allocation by Owner
                  </div>
                </PanelHeader>
                <PanelBody>
                  <OwnerAllocationChart byOwner={allocationByOwner} height={320} />
                </PanelBody>
              </Panel>
            </div>
          )}
        </div>
      )}

      {investments.length > 0 && (
        <div className="row">
          <div className="col-xl-6">
            <Panel className="mb-3">
              <PanelHeader noButton>
                <div className="d-flex align-items-center">
                  <i className="fa fa-chart-column me-2"></i>Cost vs Current Value
                </div>
              </PanelHeader>
              <PanelBody>
                <CostVsValueChart byType={costVsValueByType} height={320} />
                <div className="text-muted small mt-2">
                  <i className="fa fa-info-circle me-1"></i>
                  Grey bars show what you put in; blue shows today&apos;s value. Gaps = gains or losses by asset class.
                </div>
              </PanelBody>
            </Panel>
          </div>
          <div className="col-xl-6">
            <Panel className="mb-3">
              <PanelHeader noButton>
                <div className="d-flex align-items-center">
                  <i className="fa fa-percent me-2"></i>Return by Asset Class
                </div>
              </PanelHeader>
              <PanelBody>
                <ReturnByTypeChart byType={costVsValueByType} height={320} />
                <div className="text-muted small mt-2">
                  <i className="fa fa-info-circle me-1"></i>
                  Percentage return across each asset class. Property uses liability as the base where present.
                </div>
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {gainLossItems.length > 0 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-ranking-star me-2"></i>Biggest Movers
            </div>
          </PanelHeader>
          <PanelBody>
            <GainLossChart items={gainLossItems} height={Math.min(400, 40 + gainLossItems.length * 32)} />
            <div className="text-muted small mt-2">
              <i className="fa fa-info-circle me-1"></i>
              Top holdings by absolute gain/loss. Green = in the money, red = underwater.
            </div>
          </PanelBody>
        </Panel>
      )}

      {investments.length > 0 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex flex-wrap align-items-center gap-2">
              {adviceHistory.length > 0 && (
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setAdviceCollapsed(!adviceCollapsed)} title={adviceCollapsed ? 'Expand' : 'Collapse'}>
                  <i className={`fa fa-chevron-${adviceCollapsed ? 'down' : 'up'}`}></i>
                </button>
              )}
              <span><i className="fa fa-stethoscope me-2"></i>Investment Health Assessment</span>
              <button className="btn btn-sm btn-success ms-sm-auto" onClick={getAdvice} disabled={adviceLoading}>
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
                <p className="mb-0">Click &quot;Get AI Advice&quot; for a personalised portfolio assessment powered by Gemini.</p>
              </div>
            )}
          </PanelBody>}
        </Panel>
      )}
      </>}

      {mode === 'detail' && <>
      {investmentRelatedExpenses.length > 0 && (() => {
        const totalAll = investmentRelatedExpenses.reduce((s, e) => s + e.amount, 0);
        const groups: { key: string; label: string; icon: string; badge?: string; items: Expense[] }[] = [];
        const unassigned = investmentRelatedExpenses.filter(e => !e.investmentId);
        if (unassigned.length > 0) {
          groups.push({ key: UNASSIGNED_KEY, label: 'Unassigned', icon: 'fa-circle-question', items: unassigned });
        }
        for (const inv of investments) {
          const items = investmentRelatedExpenses.filter(e => e.investmentId === inv.id);
          if (items.length === 0) continue;
          groups.push({
            key: inv.id,
            label: inv.name,
            icon: TYPE_ICONS[inv.type] || 'fa-wallet',
            badge: inv.type,
            items,
          });
        }

        return (
          <Panel className="mb-3">
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-receipt me-2"></i>Investment Expenses
                <span className="badge bg-secondary ms-2">{investmentRelatedExpenses.length}</span>
                <span className="ms-auto fw-bold">${totalAll.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
              </div>
            </PanelHeader>
            <PanelBody>
              <p className="text-muted small mb-3">
                Expenses tagged <em>Investment Expenses</em> or <em>Investment Property</em>, grouped by holding. Assign unlinked rows to the right holding via the dropdown.
              </p>
              {groups.map(group => {
                const groupTotal = group.items.reduce((s, e) => s + e.amount, 0);
                const groupPct = totalAll > 0 ? (groupTotal / totalAll) * 100 : 0;
                const investmentExpanded = expandedInvestmentIds.has(group.key);

                const byCategory: Record<string, Expense[]> = {};
                for (const e of group.items) {
                  const cat = e.spendingCategory || 'Other';
                  if (!byCategory[cat]) byCategory[cat] = [];
                  byCategory[cat].push(e);
                }
                const catEntries = Object.entries(byCategory).sort(([, a], [, b]) => b.reduce((s, e) => s + e.amount, 0) - a.reduce((s, e) => s + e.amount, 0));
                const isUnassigned = group.key === UNASSIGNED_KEY;

                return (
                  <div key={group.key} className="mb-2">
                    <div
                      className={`d-flex align-items-center p-2 rounded ${isUnassigned ? 'bg-warning bg-opacity-10' : ''}`}
                      style={{ cursor: 'pointer', backgroundColor: !isUnassigned && investmentExpanded ? 'var(--bs-light)' : undefined }}
                      onClick={() => toggleInvestmentExpanded(group.key)}
                    >
                      <i className={`fa fa-chevron-${investmentExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '12px', fontSize: '0.7rem' }}></i>
                      <i className={`fa ${group.icon} me-2 ${isUnassigned ? 'text-warning' : ''}`}></i>
                      <span className="fw-bold">{group.label}</span>
                      {group.badge && <span className="badge bg-light text-dark border ms-2 small">{group.badge}</span>}
                      <span className="ms-auto badge bg-secondary me-2">{group.items.length}</span>
                      <span className="fw-bold me-2">${groupTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                      <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{groupPct.toFixed(1)}%</span>
                    </div>
                    {investmentExpanded && (
                      <div className="ms-4 mt-1 mb-2">
                        {catEntries.map(([category, catItems]) => {
                          const catKey = `${group.key}::${category}`;
                          const catExpanded = expandedInvCategories.has(catKey);
                          const catTotal = catItems.reduce((s, e) => s + e.amount, 0);
                          const catPct = groupTotal > 0 ? (catTotal / groupTotal) * 100 : 0;
                          const color = SPENDING_COLORS[category] || '#6c757d';
                          const catType = resolveType(category, categorySettings);

                          const byCatSub: Record<string, Expense[]> = {};
                          for (const e of catItems) {
                            const sub = e.spendingSubCategory?.trim() || NO_SUB;
                            if (!byCatSub[sub]) byCatSub[sub] = [];
                            byCatSub[sub].push(e);
                          }
                          const subEntries = Object.entries(byCatSub).sort(([a], [b]) => {
                            if (a === NO_SUB) return 1;
                            if (b === NO_SUB) return -1;
                            return a.localeCompare(b);
                          });

                          return (
                            <div key={catKey} className="mb-1">
                              <div
                                className="d-flex align-items-center px-2 py-1 rounded"
                                style={{ cursor: 'pointer', backgroundColor: catExpanded ? 'var(--bs-light)' : undefined, fontSize: '0.9rem' }}
                                onClick={() => toggleInvCategoryExpanded(catKey)}
                              >
                                <i className={`fa fa-chevron-${catExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '10px', fontSize: '0.6rem' }}></i>
                                <i className={`fa ${SPENDING_ICONS[category] || 'fa-ellipsis'} me-2`} style={{ color }}></i>
                                <span className="fw-medium flex-grow-1">{category}</span>
                                {catType && <span className={`badge ${INV_TYPE_BADGES[catType]} me-2 small`}>{INV_TYPE_LABELS[catType]}</span>}
                                <span className="badge bg-light text-dark border me-2">{catItems.length}</span>
                                <span className="me-2">${catTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                                <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{catPct.toFixed(1)}%</span>
                              </div>
                              {catExpanded && (
                                <div className="ms-4 mt-1 mb-2">
                                  {subEntries.map(([sub, subItems]) => {
                                    const subKey = `${catKey}::${sub}`;
                                    const subExpanded = expandedInvSubs.has(subKey);
                                    const subTotal = subItems.reduce((s, e) => s + e.amount, 0);
                                    const subPct = catTotal > 0 ? (subTotal / catTotal) * 100 : 0;
                                    const isNoSub = sub === NO_SUB;
                                    const sortedSubItems = [...subItems].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                                    return (
                                      <div key={subKey} className="mb-1">
                                        <div
                                          className="d-flex align-items-center px-2 py-1 rounded"
                                          style={{ cursor: 'pointer', backgroundColor: subExpanded ? 'var(--bs-light)' : undefined, fontSize: '0.85rem' }}
                                          onClick={() => toggleInvSubExpanded(subKey)}
                                        >
                                          <i className={`fa fa-chevron-${subExpanded ? 'down' : 'right'} me-2 text-muted`} style={{ width: '10px', fontSize: '0.55rem' }}></i>
                                          <span className={`flex-grow-1 ${isNoSub ? 'fst-italic text-muted' : ''}`}>{sub}</span>
                                          <span className="badge bg-light text-dark border me-2">{subItems.length}</span>
                                          <span className="me-2">${subTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                                          <span className="small text-muted" style={{ width: '45px', textAlign: 'right' }}>{subPct.toFixed(1)}%</span>
                                        </div>
                                        {subExpanded && (
                                          <div className="ms-4 mt-1 mb-2 table-responsive">
                                            <table className="table table-sm table-hover mb-0">
                                              <thead>
                                                <tr>
                                                  <th style={{ width: '90px' }}>Date</th>
                                                  <th>Description</th>
                                                  <th style={{ width: '140px' }}>Tax Category</th>
                                                  <th className="text-end" style={{ width: '100px' }}>Amount</th>
                                                  <th style={{ width: '230px' }}>Linked to</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {sortedSubItems.map(e => (
                                                  <tr key={e.id}>
                                                    <td className="small text-muted">{new Date(e.date).toLocaleDateString('en-AU')}</td>
                                                    <td className="small">{e.description}</td>
                                                    <td className="small text-muted">{e.category}</td>
                                                    <td className="text-end small fw-bold">${e.amount.toFixed(2)}</td>
                                                    <td onClick={ev => ev.stopPropagation()}>
                                                      <select
                                                        className="form-select form-select-sm"
                                                        value={e.investmentId || ''}
                                                        onChange={ev => assignExpenseToInvestment(e.id, ev.target.value || null)}
                                                      >
                                                        <option value="">— Unassigned —</option>
                                                        {investments.map(inv => (
                                                          <option key={inv.id} value={inv.id}>{inv.name} ({inv.type})</option>
                                                        ))}
                                                      </select>
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
                  </div>
                );
              })}
            </PanelBody>
          </Panel>
        );
      })()}

      <div className="row">
        <div className="col-12">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span>Investments</span>
                <button className="btn btn-success btn-sm ms-sm-auto" onClick={() => { if (showForm) cancelEdit(); else setShowForm(true); }}>
                  {showForm ? <><i className="fa fa-times me-1"></i>Cancel</> : <><i className="fa fa-plus me-1"></i>Add Investment</>}
                </button>
              </div>
            </PanelHeader>
            <PanelBody>
              {showForm && (
                <form onSubmit={handleSubmit} className="mb-3 p-3 bg-light rounded" style={{ maxWidth: '400px' }}>
                  <div className="mb-3">
                    <label className="form-label text-muted small mb-1">Investment type</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...EMPTY_FORM, type: e.target.value, owner: form.owner })}>
                      {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small mb-1">Name</label>
                    <input type="text" className="form-control" placeholder={NAME_PLACEHOLDERS[form.type] || 'Name'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  {familyMembers.length > 0 && (
                    <div className="mb-3">
                      <label className="form-label text-muted small mb-1">Owner</label>
                      <select className="form-select" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}>
                        <option value="">Unassigned</option>
                        {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        {familyMembers.length >= 2 && <option value="Joint">Joint</option>}
                      </select>
                    </div>
                  )}
                  <div className="row g-3 mb-3">
                    <TypeSpecificFields form={form} setForm={setForm} />
                  </div>
                  <button type="submit" className="btn btn-success w-100" disabled={saving}>
                    {saving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving...</> : editingId ? <><i className="fa fa-check me-1"></i>Update Investment</> : <><i className="fa fa-plus me-1"></i>Add Investment</>}
                  </button>
                </form>
              )}

              {loading ? (
                <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
              ) : investments.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa fa-chart-line fa-3x mb-3 d-block"></i>
                  <p>No investments yet. Add your first investment to get started.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Owner</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th className="text-end">Cost Basis</th>
                        <th className="text-end">Liability</th>
                        <th className="text-end">Current Value</th>
                        <th className="text-end">Gain / Loss</th>
                        <th className="text-end">Est. CGT</th>
                        <th style={{ width: '70px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map(inv => {
                        const gainLoss = inv.liability
                          ? inv.currentValue - inv.liability  // Property equity
                          : inv.currentValue - inv.costBasis;
                        const returnPct = inv.costBasis > 0 ? ((gainLoss / inv.costBasis) * 100) : 0;
                        const cgt = estimateCgt(inv, familyMembers);
                        return (
                          <tr key={inv.id}>
                            <td className="fw-bold">{inv.name}</td>
                            <td className="text-muted small">{inv.owner || '—'}</td>
                            <td>
                              <span className={`badge ${TYPE_COLORS[inv.type] || 'bg-secondary'}`}>
                                <i className={`fa ${TYPE_ICONS[inv.type] || 'fa-wallet'} me-1`}></i>
                                {inv.type}
                              </span>
                            </td>
                            <td className="text-muted small">{formatDetail(inv)}</td>
                            <td className="text-end">${inv.costBasis.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td className="text-end">{inv.type === 'Property' && inv.liability ? `$${inv.liability.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td className="text-end">${inv.currentValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td className={`text-end fw-bold ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                              {gainLoss >= 0 ? '+' : ''}{gainLoss.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                              <small className="ms-1">({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%)</small>
                            </td>
                            <td className="text-end text-muted small">
                              {cgt ? cgt.label : '—'}
                            </td>
                            <td className="text-nowrap">
                              <button className="btn btn-xs btn-primary me-1" onClick={() => startEdit(inv)} title="Edit">
                                <i className="fa fa-pencil-alt"></i>
                              </button>
                              <button className="btn btn-xs btn-danger" onClick={() => removeInvestment(inv.id)} title="Delete">
                                <i className="fa fa-times"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const totalCgt = investments.reduce((sum, inv) => {
                          const cgt = estimateCgt(inv, familyMembers);
                          return sum + (cgt ? cgt.amount : 0);
                        }, 0);
                        return (
                          <tr className="fw-bold">
                            <td colSpan={5}>Total</td>
                            <td className="text-end">${totalLiability.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td className="text-end">${totalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td className={`text-end ${totalGainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                              {totalGainLoss >= 0 ? '+' : ''}{totalGainLoss.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-end text-muted">${totalCgt.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td></td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
      </>}
    </>
  );
}
