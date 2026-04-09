'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Investment, FamilyMember } from '@/lib/types';

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
  purchasePrice: string;
  rentalIncome: string;
  liability: string;
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
  purchasePrice: '', rentalIncome: '', liability: '',
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
    return { ...base, costBasis: pp, currentValue: parseFloat(form.currentValue), rentalIncomeAnnual: parseFloat(form.rentalIncome) || 0, liability: parseFloat(form.liability) || 0 };
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
          <label className="form-label text-muted small mb-1">Rental income per year</label>
          <CurrencyInput placeholder="0.00" value={form.rentalIncome} onChange={v => setForm({ ...form, rentalIncome: v })} step="1" />
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

function formatDetail(inv: Investment): string {
  if (TRADED_TYPES.includes(inv.type) && inv.units) return `${inv.units} units @ $${inv.buyPricePerUnit?.toFixed(2)}`;
  if (inv.type === 'Property') {
    const parts: string[] = [];
    if (inv.liability) parts.push(`Mortgage: $${inv.liability.toLocaleString()}`);
    if (inv.rentalIncomeAnnual) parts.push(`Rental: $${inv.rentalIncomeAnnual.toLocaleString()}/yr`);
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
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', salary: '' });
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const adviceHistoryRef = useRef(adviceHistory);
  adviceHistoryRef.current = adviceHistory;

  const saveChat = useCallback(async (history: { role: 'user' | 'model'; text: string }[]) => {
    await fetch('/api/advice-chat', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'investments', history }),
    });
  }, []);

  useEffect(() => {
    fetch('/api/advice-chat?type=investments')
      .then(res => res.ok ? res.json() : { history: [] })
      .then(data => { if (data.history?.length) setAdviceHistory(data.history); });
  }, []);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/investments');
    if (res.ok) setInvestments(await res.json());
    setLoading(false);
  }, []);

  const fetchFamilyMembers = useCallback(async () => {
    const res = await fetch('/api/family-members');
    if (res.ok) setFamilyMembers(await res.json());
  }, []);

  useEffect(() => { fetchInvestments(); fetchFamilyMembers(); }, [fetchInvestments, fetchFamilyMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const inv = buildInvestment(form);

    if (editingId) {
      const { id: _unusedId, ...data } = inv;
      const res = await fetch('/api/investments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...data }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInvestments(prev => prev.map(i => i.id === editingId ? updated : i));
        cancelEdit();
      }
    } else {
      const { id: _unusedId, ...data } = inv;
      const res = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const saved = await res.json();
        setInvestments(prev => [...prev, saved]);
        cancelEdit();
      }
    }
    setSaving(false);
  };

  const startEdit = (inv: Investment) => {
    const f: FormState = { ...EMPTY_FORM, name: inv.name, type: inv.type, owner: inv.owner || '' };
    if (TRADED_TYPES.includes(inv.type)) {
      f.units = String(inv.units || '');
      f.buyPricePerUnit = String(inv.buyPricePerUnit || '');
      f.currentValue = String(inv.currentValue);
    } else if (inv.type === 'Property') {
      f.purchasePrice = String(inv.costBasis);
      f.currentValue = String(inv.currentValue);
      f.liability = String(inv.liability || '');
      f.rentalIncome = String(inv.rentalIncomeAnnual || '');
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
    await fetch(`/api/investments?id=${id}`, { method: 'DELETE' });
    setInvestments(prev => prev.filter(i => i.id !== id));
  };

  const addOrUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: memberForm.name, salary: parseFloat(memberForm.salary) };
    if (editingMemberId) {
      const res = await fetch('/api/family-members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingMemberId, ...body }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFamilyMembers(prev => prev.map(m => m.id === editingMemberId ? updated : m));
      }
    } else {
      const res = await fetch('/api/family-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const member = await res.json();
        setFamilyMembers(prev => [...prev, member]);
      }
    }
    setMemberForm({ name: '', salary: '' });
    setEditingMemberId(null);
    setShowMemberForm(false);
  };

  const removeMember = async (id: string) => {
    await fetch(`/api/family-members?id=${id}`, { method: 'DELETE' });
    setFamilyMembers(prev => prev.filter(m => m.id !== id));
  };

  const streamAdvice = async (history: { role: 'user' | 'model'; text: string }[], followUp?: string) => {
    setAdviceLoading(true);
    const res = await fetch('/api/investments/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, followUp }),
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
  const totalGainLoss = investments.reduce((sum, i) => {
    return sum + (i.liability ? i.currentValue - i.liability : i.currentValue - i.costBasis);
  }, 0);
  const totalReturnPct = totalCost > 0 ? ((totalGainLoss / totalCost) * 100) : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue;
    return acc;
  }, {} as Record<string, number>);

  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

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
      <div className="d-flex align-items-center mb-3">
        <h1 className="page-header mb-0">Family Portfolio</h1>
      </div>

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
          <div className="card border-0 bg-indigo text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Asset Allocation</div>
              {sortedAllocations.length === 0 ? (
                <h3 className="text-white mb-0">---</h3>
              ) : (
                <div className="mt-2">
                  {sortedAllocations.map(([type, value]) => {
                    const pct = (value / totalValue) * 100;
                    return (
                      <div key={type} className="mb-2">
                        <div className="d-flex align-items-center mb-1">
                          <i className={`fa ${TYPE_ICONS[type] || 'fa-wallet'} me-2 text-white text-opacity-50`} style={{ fontSize: '0.75rem' }}></i>
                          <span className="flex-grow-1 small">{type}</span>
                          <span className="fw-bold small">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="progress" style={{ height: '3px' }}>
                          <div className="progress-bar bg-white bg-opacity-50" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

      {investments.length > 0 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              {adviceHistory.length > 0 && (
                <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => setAdviceCollapsed(!adviceCollapsed)} title={adviceCollapsed ? 'Expand' : 'Collapse'}>
                  <i className={`fa fa-chevron-${adviceCollapsed ? 'down' : 'up'}`}></i>
                </button>
              )}
              <i className="fa fa-stethoscope me-2"></i>Investment Health Assessment
              <button className="btn btn-sm btn-success ms-auto" onClick={getAdvice} disabled={adviceLoading}>
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

      <Panel className="mb-3">
        <PanelHeader noButton>
          <div className="d-flex align-items-center">
            <i className="fa fa-users me-2"></i>Family Members
            <button className="btn btn-sm btn-success ms-auto" onClick={() => { setShowMemberForm(!showMemberForm); setEditingMemberId(null); setMemberForm({ name: '', salary: '' }); }}>
              {showMemberForm ? <><i className="fa fa-times me-1"></i>Cancel</> : <><i className="fa fa-plus me-1"></i>Add Member</>}
            </button>
          </div>
        </PanelHeader>
        <PanelBody>
          {showMemberForm && (
            <form onSubmit={addOrUpdateMember} className="row g-2 mb-3 p-3 bg-light rounded">
              <div className="col-md-4">
                <input type="text" className="form-control" placeholder="Name" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} required />
              </div>
              <div className="col-md-4">
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input type="number" className="form-control" placeholder="Annual salary" step="1" min="0" value={memberForm.salary} onChange={e => setMemberForm({ ...memberForm, salary: e.target.value })} required />
                </div>
              </div>
              <div className="col-md-4">
                <button type="submit" className="btn btn-success w-100">
                  {editingMemberId ? <><i className="fa fa-check me-1"></i>Update</> : <><i className="fa fa-plus me-1"></i>Add</>}
                </button>
              </div>
            </form>
          )}
          {familyMembers.length === 0 ? (
            <div className="text-muted text-center py-3">
              <p className="mb-0">Add family members to track investment ownership and tax brackets.</p>
            </div>
          ) : (
            <div className="d-flex flex-wrap gap-3">
              {familyMembers.map(m => {
                const bracket = m.salary <= 18200 ? '0%' : m.salary <= 45000 ? '16%' : m.salary <= 135000 ? '30%' : m.salary <= 190000 ? '37%' : '45%';
                const memberInvestments = investments.filter(i => i.owner === m.name);
                const memberValue = memberInvestments.reduce((sum, i) => sum + i.currentValue, 0);
                return (
                  <div key={m.id} className="card border mb-0" style={{ minWidth: '220px', flex: '1 1 220px' }}>
                    <div className="card-body py-2 px-3">
                      <div className="d-flex align-items-center">
                        <div className="flex-grow-1">
                          <div className="fw-bold">{m.name}</div>
                          <div className="small text-muted">
                            Salary: ${m.salary.toLocaleString('en-AU')} <span className="badge bg-secondary ms-1">{bracket} + ML</span>
                          </div>
                          <div className="small text-muted">{memberInvestments.length} investments &middot; ${memberValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="ms-2">
                          <button className="btn btn-xs btn-primary me-1" onClick={() => { setMemberForm({ name: m.name, salary: String(m.salary) }); setEditingMemberId(m.id); setShowMemberForm(true); }} title="Edit">
                            <i className="fa fa-pencil-alt"></i>
                          </button>
                          <button className="btn btn-xs btn-danger" onClick={() => removeMember(m.id)} title="Delete">
                            <i className="fa fa-times"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>

      <div className="row">
        <div className="col-12">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                Investments
                <button className="btn btn-success btn-sm ms-auto" onClick={() => { if (showForm) cancelEdit(); else setShowForm(true); }}>
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
                        <th className="text-end">Current Value</th>
                        <th className="text-end">Gain / Loss</th>
                        <th style={{ width: '70px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map(inv => {
                        const gainLoss = inv.liability
                          ? inv.currentValue - inv.liability  // Property equity
                          : inv.currentValue - inv.costBasis;
                        const returnPct = inv.costBasis > 0 ? ((gainLoss / inv.costBasis) * 100) : 0;
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
                            <td className="text-end">${inv.currentValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td className={`text-end fw-bold ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                              {gainLoss >= 0 ? '+' : ''}{gainLoss.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                              <small className="ms-1">({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%)</small>
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
                      <tr className="fw-bold">
                        <td colSpan={5}>Total</td>
                        <td className="text-end">${totalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                        <td className={`text-end ${totalGainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                          {totalGainLoss >= 0 ? '+' : ''}{totalGainLoss.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
