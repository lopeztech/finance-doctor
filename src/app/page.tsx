'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, Investment } from '@/lib/types';

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

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/expenses?fy=2025-2026').then(r => r.ok ? r.json() : []),
      fetch('/api/investments').then(r => r.ok ? r.json() : []),
    ]).then(([exp, inv]) => {
      setExpenses(exp);
      setInvestments(inv);
      setLoading(false);
    });
  }, []);

  const totalDeductions = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  const totalPortfolio = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const totalGainLoss = investments.reduce((sum, i) => {
    return sum + ((i as any).liability ? i.currentValue - (i as any).liability : i.currentValue - i.costBasis);
  }, 0);
  const totalReturnPct = totalCost > 0 ? ((totalGainLoss / totalCost) * 100) : 0;

  const allocationByType = investments.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + i.currentValue;
    return acc;
  }, {} as Record<string, number>);
  const sortedAllocations = Object.entries(allocationByType).sort(([, a], [, b]) => b - a);

  const typeCount = Object.keys(allocationByType).length;
  const maxPct = totalPortfolio > 0
    ? Math.max(...Object.values(allocationByType).map(v => (v / totalPortfolio) * 100))
    : 0;

  const getInvestmentHealth = () => {
    if (investments.length === 0) return null;
    let score = 0;
    if (typeCount >= 4) score += 2; else if (typeCount >= 2) score += 1;
    if (maxPct < 40) score += 2; else if (maxPct < 60) score += 1;
    if (allocationByType['Superannuation']) score += 1;
    if (score >= 4) return { label: 'Healthy', color: 'success', icon: 'fa-heart' };
    if (score >= 2) return { label: 'Fair', color: 'warning', icon: 'fa-heart-crack' };
    return { label: 'Needs Attention', color: 'danger', icon: 'fa-heart-pulse' };
  };

  const getTaxHealth = () => {
    if (expenses.length === 0) return null;
    const cats = Object.keys(categoryTotals).length;
    if (cats >= 7) return { label: 'Healthy', color: 'success', icon: 'fa-heart' };
    if (cats >= 4) return { label: 'Fair', color: 'warning', icon: 'fa-heart-crack' };
    return { label: 'Needs Attention', color: 'danger', icon: 'fa-heart-pulse' };
  };

  const taxHealth = getTaxHealth();
  const investHealth = getInvestmentHealth();

  if (loading) {
    return (
      <>
        <h1 className="page-header">Dashboard</h1>
        <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      </>
    );
  }

  return (
    <>
      <h1 className="page-header">Dashboard</h1>

      <div className="row mb-3">
        <div className="col-lg-3">
          <div className="card border-0 bg-teal text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Portfolio Value</div>
              <h3 className="text-white mb-0">${totalPortfolio.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
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
          <div className="card border-0 bg-dark text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Tax Deductions YTD</div>
              <h3 className="text-white mb-0">${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card border-0 bg-indigo text-white mb-3">
            <div className="card-body">
              <div className="text-white text-opacity-75 mb-1">Expense Categories</div>
              <h3 className="text-white mb-0">{Object.keys(categoryTotals).length} / 10</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-chart-line me-2"></i>Investment Health
                {investHealth && (
                  <span className={`badge bg-${investHealth.color} ms-auto`}>
                    <i className={`fa ${investHealth.icon} me-1`}></i>{investHealth.label}
                  </span>
                )}
              </div>
            </PanelHeader>
            <PanelBody>
              {investments.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-chart-line fa-2x mb-2 d-block"></i>
                  <p className="mb-2">No investments tracked yet</p>
                  <Link href="/investments" className="btn btn-sm btn-teal">Add Investments</Link>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    {sortedAllocations.map(([type, value]) => {
                      const pct = totalPortfolio > 0 ? (value / totalPortfolio) * 100 : 0;
                      return (
                        <div key={type} className="mb-2">
                          <div className="d-flex align-items-center mb-1">
                            <i className={`fa ${TYPE_ICONS[type] || 'fa-wallet'} me-2 text-muted`} style={{ fontSize: '0.8rem', width: '16px' }}></i>
                            <span className="flex-grow-1 small">{type}</span>
                            <span className="small fw-bold">${value.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</span>
                            <span className="small text-muted ms-2" style={{ width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="progress" style={{ height: '3px' }}>
                            <div className={`progress-bar ${TYPE_COLORS[type] || 'bg-secondary'}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Link href="/investments" className="btn btn-sm btn-outline-primary">View Details <i className="fa fa-arrow-right ms-1"></i></Link>
                </>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>
              <div className="d-flex align-items-center">
                <i className="fa fa-file-invoice-dollar me-2"></i>Tax Health
                {taxHealth && (
                  <span className={`badge bg-${taxHealth.color} ms-auto`}>
                    <i className={`fa ${taxHealth.icon} me-1`}></i>{taxHealth.label}
                  </span>
                )}
              </div>
            </PanelHeader>
            <PanelBody>
              {expenses.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-file-invoice-dollar fa-2x mb-2 d-block"></i>
                  <p className="mb-2">No expenses tracked for FY 2025-2026</p>
                  <Link href="/tax" className="btn btn-sm btn-teal">Add Expenses</Link>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    {sortedCategories.map(([category, total]) => (
                      <div key={category} className="mb-2">
                        <div className="d-flex align-items-center mb-1">
                          <i className={`fa ${CATEGORY_ICONS[category] || 'fa-receipt'} me-2 text-muted`} style={{ fontSize: '0.8rem', width: '16px' }}></i>
                          <span className="flex-grow-1 small">{category}</span>
                          <span className="small fw-bold">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="progress" style={{ height: '3px' }}>
                          <div className="progress-bar bg-teal" style={{ width: `${(total / totalDeductions) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/tax" className="btn btn-sm btn-outline-primary">View Details <i className="fa fa-arrow-right ms-1"></i></Link>
                </>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
