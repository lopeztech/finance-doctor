'use client';

import { useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';

interface Investment {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  purchasePrice: number;
  units: number;
}

const INVESTMENT_TYPES = [
  'Australian Shares',
  'International Shares',
  'ETFs',
  'Bonds',
  'Property',
  'Cryptocurrency',
  'Cash / Term Deposit',
  'Superannuation',
  'Other',
];

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

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: INVESTMENT_TYPES[0], currentValue: '', purchasePrice: '', units: '' });

  const addInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    const investment: Investment = {
      id: crypto.randomUUID(),
      name: form.name,
      type: form.type,
      currentValue: parseFloat(form.currentValue),
      purchasePrice: parseFloat(form.purchasePrice),
      units: parseFloat(form.units) || 1,
    };
    setInvestments([...investments, investment]);
    setForm({ name: '', type: INVESTMENT_TYPES[0], currentValue: '', purchasePrice: '', units: '' });
    setShowForm(false);
  };

  const removeInvestment = (id: string) => {
    setInvestments(investments.filter(i => i.id !== id));
  };

  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.purchasePrice * i.units, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? ((totalGainLoss / totalCost) * 100) : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue;
    return acc;
  }, {} as Record<string, number>);

  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

  // Diversification score: how many asset classes, and how balanced
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
                  <div className="col-md-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Name (e.g. VAS, CBA)"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Units"
                      step="any"
                      min="0"
                      value={form.units}
                      onChange={(e) => setForm({ ...form, units: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Buy price/unit"
                      step="0.01"
                      min="0"
                      value={form.purchasePrice}
                      onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Current value"
                      step="0.01"
                      min="0"
                      value={form.currentValue}
                      onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                      required
                    />
                  </div>
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
                        <th className="text-end">Units</th>
                        <th className="text-end">Cost Basis</th>
                        <th className="text-end">Current Value</th>
                        <th className="text-end">Gain / Loss</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map(inv => {
                        const cost = inv.purchasePrice * inv.units;
                        const gainLoss = inv.currentValue - cost;
                        const returnPct = cost > 0 ? ((gainLoss / cost) * 100) : 0;
                        return (
                          <tr key={inv.id}>
                            <td className="fw-bold">{inv.name}</td>
                            <td>
                              <span className={`badge ${TYPE_COLORS[inv.type] || 'bg-secondary'}`}>
                                <i className={`fa ${TYPE_ICONS[inv.type] || 'fa-wallet'} me-1`}></i>
                                {inv.type}
                              </span>
                            </td>
                            <td className="text-end">{inv.units}</td>
                            <td className="text-end">${cost.toFixed(2)}</td>
                            <td className="text-end">${inv.currentValue.toFixed(2)}</td>
                            <td className={`text-end fw-bold ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                              {gainLoss >= 0 ? '+' : ''}{gainLoss.toFixed(2)}
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
                        <td className="text-end">${totalValue.toFixed(2)}</td>
                        <td className={`text-end ${totalGainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                          {totalGainLoss >= 0 ? '+' : ''}{totalGainLoss.toFixed(2)}
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
                          <div
                            className={`progress-bar ${TYPE_COLORS[type] || 'bg-secondary'}`}
                            style={{ width: `${pct}%` }}
                          ></div>
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
