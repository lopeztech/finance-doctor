'use client';

import { useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';

interface Investment {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  costBasis: number;
  // Type-specific fields
  units?: number;
  buyPricePerUnit?: number;
  rentalIncomeAnnual?: number;
  interestRate?: number;
  employerContribution?: number;
  couponRate?: number;
  maturityDate?: string;
}

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
  // Traded assets
  units: string;
  buyPricePerUnit: string;
  currentValue: string;
  // Property
  purchasePrice: string;
  rentalIncome: string;
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
  name: '', type: INVESTMENT_TYPES[0],
  units: '', buyPricePerUnit: '', currentValue: '',
  purchasePrice: '', rentalIncome: '',
  amount: '', interestRate: '',
  faceValue: '', couponRate: '', maturityDate: '',
  balance: '', employerContribution: '',
};

function buildInvestment(form: FormState): Investment {
  const base = { id: crypto.randomUUID(), name: form.name, type: form.type };

  if (TRADED_TYPES.includes(form.type)) {
    const units = parseFloat(form.units);
    const buyPrice = parseFloat(form.buyPricePerUnit);
    return { ...base, units, buyPricePerUnit: buyPrice, costBasis: units * buyPrice, currentValue: parseFloat(form.currentValue) };
  }
  if (form.type === 'Property') {
    const pp = parseFloat(form.purchasePrice);
    return { ...base, costBasis: pp, currentValue: parseFloat(form.currentValue), rentalIncomeAnnual: parseFloat(form.rentalIncome) || 0 };
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

function TypeSpecificFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { type } = form;

  if (TRADED_TYPES.includes(type)) {
    return (
      <>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Units" step="any" min="0" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} required />
        </div>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Buy price/unit" step="0.01" min="0" value={form.buyPricePerUnit} onChange={e => setForm({ ...form, buyPricePerUnit: e.target.value })} required />
        </div>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Current total value" step="0.01" min="0" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} required />
        </div>
      </>
    );
  }

  if (type === 'Property') {
    return (
      <>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Purchase price" step="1" min="0" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} required />
        </div>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Current value" step="1" min="0" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} required />
        </div>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Rental income/yr" step="1" min="0" value={form.rentalIncome} onChange={e => setForm({ ...form, rentalIncome: e.target.value })} />
        </div>
      </>
    );
  }

  if (type === 'Cash / Term Deposit') {
    return (
      <>
        <div className="col-md-3">
          <input type="number" className="form-control" placeholder="Amount" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div className="col-md-3">
          <input type="number" className="form-control" placeholder="Interest rate %" step="0.01" min="0" value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} />
        </div>
      </>
    );
  }

  if (type === 'Bonds') {
    return (
      <>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Face value" step="0.01" min="0" value={form.faceValue} onChange={e => setForm({ ...form, faceValue: e.target.value })} required />
        </div>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Coupon rate %" step="0.01" min="0" value={form.couponRate} onChange={e => setForm({ ...form, couponRate: e.target.value })} />
        </div>
        <div className="col-md-2">
          <input type="date" className="form-control" placeholder="Maturity date" value={form.maturityDate} onChange={e => setForm({ ...form, maturityDate: e.target.value })} />
        </div>
      </>
    );
  }

  if (type === 'Superannuation') {
    return (
      <>
        <div className="col-md-3">
          <input type="number" className="form-control" placeholder="Current balance" step="0.01" min="0" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} required />
        </div>
        <div className="col-md-3">
          <input type="number" className="form-control" placeholder="Employer contrib %" step="0.5" min="0" value={form.employerContribution} onChange={e => setForm({ ...form, employerContribution: e.target.value })} />
        </div>
      </>
    );
  }

  // Other
  return (
    <>
      <div className="col-md-3">
        <input type="number" className="form-control" placeholder="Purchase price" step="0.01" min="0" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} required />
      </div>
      <div className="col-md-3">
        <input type="number" className="form-control" placeholder="Current value" step="0.01" min="0" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} required />
      </div>
    </>
  );
}

function formatDetail(inv: Investment): string {
  if (TRADED_TYPES.includes(inv.type) && inv.units) return `${inv.units} units @ $${inv.buyPricePerUnit?.toFixed(2)}`;
  if (inv.type === 'Property' && inv.rentalIncomeAnnual) return `Rental: $${inv.rentalIncomeAnnual.toLocaleString()}/yr`;
  if (inv.type === 'Cash / Term Deposit' && inv.interestRate) return `${inv.interestRate}% p.a.`;
  if (inv.type === 'Bonds' && inv.couponRate) return `${inv.couponRate}% coupon`;
  if (inv.type === 'Superannuation' && inv.employerContribution) return `${inv.employerContribution}% employer`;
  return '';
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const addInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    setInvestments([...investments, buildInvestment(form)]);
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
  };

  const removeInvestment = (id: string) => {
    setInvestments(investments.filter(i => i.id !== id));
  };

  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const totalGainLoss = totalValue - totalCost;
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
        <h1 className="page-header mb-0">Investment Health Check</h1>
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
              <div className="text-white text-opacity-75 mb-1">Asset Classes</div>
              <h3 className="text-white mb-0">{typeCount}</h3>
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

      <div className="row">
        <div className="col-xl-8">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                Investments
                <button className="btn btn-success btn-sm ms-auto" onClick={() => setShowForm(!showForm)}>
                  <i className="fa fa-plus me-1"></i> Add Investment
                </button>
              </div>
            </PanelHeader>
            <PanelBody>
              {showForm && (
                <form onSubmit={addInvestment} className="row g-2 mb-3 p-3 bg-light rounded">
                  <div className="col-md-2">
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...EMPTY_FORM, type: e.target.value })}>
                      {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <input type="text" className="form-control" placeholder={NAME_PLACEHOLDERS[form.type] || 'Name'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <TypeSpecificFields form={form} setForm={setForm} />
                  <div className="col-md-1">
                    <button type="submit" className="btn btn-success w-100">Add</button>
                  </div>
                </form>
              )}

              {investments.length === 0 ? (
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
                        <th>Type</th>
                        <th>Details</th>
                        <th className="text-end">Cost Basis</th>
                        <th className="text-end">Current Value</th>
                        <th className="text-end">Gain / Loss</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map(inv => {
                        const gainLoss = inv.currentValue - inv.costBasis;
                        const returnPct = inv.costBasis > 0 ? ((gainLoss / inv.costBasis) * 100) : 0;
                        return (
                          <tr key={inv.id}>
                            <td className="fw-bold">{inv.name}</td>
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
                            <td>
                              <button className="btn btn-xs btn-danger" onClick={() => removeInvestment(inv.id)}>
                                <i className="fa fa-times"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="fw-bold">
                        <td colSpan={4}>Total</td>
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

        <div className="col-xl-4">
          <Panel>
            <PanelHeader noButton>Asset Allocation</PanelHeader>
            <PanelBody>
              {sortedAllocations.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">Add investments to see your allocation</p>
                </div>
              ) : (
                <div>
                  {sortedAllocations.map(([type, value]) => {
                    const pct = (value / totalValue) * 100;
                    return (
                      <div key={type} className="mb-3">
                        <div className="d-flex align-items-center mb-1">
                          <i className={`fa ${TYPE_ICONS[type] || 'fa-wallet'} me-2 text-muted`}></i>
                          <span className="flex-grow-1">{type}</span>
                          <span className="fw-bold">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="progress" style={{ height: '4px' }}>
                          <div className={`progress-bar ${TYPE_COLORS[type] || 'bg-secondary'}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </PanelBody>
          </Panel>

          {investments.length > 0 && (
            <Panel theme="success">
              <PanelHeader noButton>
                <i className="fa fa-stethoscope me-2"></i>Investment Health Assessment
              </PanelHeader>
              <PanelBody>
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <i className="fa fa-heartbeat text-danger me-2"></i>
                    <strong>Diagnosis</strong>
                  </div>
                  <ul className="text-muted mb-0 ps-3">
                    {typeCount < 3 && (
                      <li>Low diversification — your portfolio is concentrated in {typeCount} asset class{typeCount > 1 ? 'es' : ''}.</li>
                    )}
                    {maxAllocationPct > 60 && (
                      <li>Over {maxAllocationPct.toFixed(0)}% of your portfolio is in a single asset class. Consider rebalancing.</li>
                    )}
                    {typeCount >= 4 && maxAllocationPct < 40 && (
                      <li>Well diversified across {typeCount} asset classes with no single class dominating.</li>
                    )}
                    {!allocationByType['Superannuation'] && (
                      <li>No superannuation recorded. Consider salary sacrifice for tax-effective growth.</li>
                    )}
                    {!allocationByType['International Shares'] && !allocationByType['ETFs'] && (
                      <li>No international exposure. Consider global ETFs to reduce home-country bias.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="d-flex align-items-center mb-2">
                    <i className="fa fa-prescription text-success me-2"></i>
                    <strong>Prescription</strong>
                  </div>
                  <ul className="text-muted mb-0 ps-3">
                    {maxAllocationPct > 50 && (
                      <li>Rebalance to reduce concentration risk — aim for no single class above 40%.</li>
                    )}
                    {typeCount < 3 && (
                      <li>Add 2-3 more asset classes for better diversification.</li>
                    )}
                    {!allocationByType['Bonds'] && !allocationByType['Cash / Term Deposit'] && (
                      <li>Consider adding defensive assets (bonds or cash) for stability.</li>
                    )}
                    {totalGainLoss < 0 && (
                      <li>Review underperforming holdings — consider tax-loss harvesting before EOFY.</li>
                    )}
                    {totalGainLoss > 0 && allocationByType['Cryptocurrency'] && (
                      <li>Remember crypto gains are taxable — plan for CGT on any realised gains.</li>
                    )}
                    {allocationByType['Property'] && !allocationByType['Cash / Term Deposit'] && (
                      <li>With property exposure, ensure you have a cash buffer for maintenance and vacancies.</li>
                    )}
                    {investments.some(i => i.type === 'Superannuation' && i.employerContribution && i.employerContribution < 11.5) && (
                      <li>Your employer contribution appears below the 11.5% SG rate — verify with your employer.</li>
                    )}
                  </ul>
                </div>
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
