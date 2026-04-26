'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, Investment, FamilyMember } from '@/lib/types';
import { fetchDashboardTips, type DashboardTip } from '@/lib/functions-client';
import { listExpenses } from '@/lib/expenses-repo';
import { listInvestments } from '@/lib/investments-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';
import { PageFilters, type FilterGroup } from '@/components/page-filters';
import { currentFinancialYear, maybeEmitEofyReminder } from '@/lib/tax-deadline';
import { usePreferences } from '@/lib/use-preferences';
import BudgetsWidget from '@/components/budgets-widget';

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
  const { prefs, ready: prefsReady } = usePreferences();
  const initialFy = prefs.defaults.defaultFinancialYear === 'current'
    ? currentFinancialYear()
    : prefs.defaults.defaultFinancialYear;
  const [financialYear, setFinancialYear] = useState(initialFy);
  const [fyLockedFromPrefs, setFyLockedFromPrefs] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<DashboardTip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);

  // When prefs land after the initial render (e.g. logged-in fetch finishes),
  // sync the FY to the saved default — but only if the user hasn't manually
  // changed it yet.
  useEffect(() => {
    if (!prefsReady || fyLockedFromPrefs) return;
    const desired = prefs.defaults.defaultFinancialYear === 'current'
      ? currentFinancialYear()
      : prefs.defaults.defaultFinancialYear;
    setFinancialYear(desired);
    setFyLockedFromPrefs(true);
  }, [prefsReady, fyLockedFromPrefs, prefs.defaults.defaultFinancialYear]);

  const fetchExpenses = useCallback(async () => {
    setExpenses(await listExpenses(financialYear));
  }, [financialYear]);

  useEffect(() => {
    Promise.all([
      fetchExpenses(),
      listInvestments().then(setInvestments).catch(() => setInvestments([])),
      listFamilyMembers().then(setFamilyMembers).catch(() => setFamilyMembers([])),
    ]).then(() => setLoading(false));

    fetchDashboardTips()
      .then(result => { setTips(result); setTipsLoading(false); })
      .catch(() => setTipsLoading(false));

    maybeEmitEofyReminder().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch expenses when FY changes (after initial load)
  useEffect(() => {
    if (!loading) fetchExpenses();
  }, [financialYear, fetchExpenses, loading]);

  const totalDeductions = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([a], [b]) => a.localeCompare(b));

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

  // Australian 2025-26 tax calculation
  function calculateTax(taxableIncome: number): number {
    if (taxableIncome <= 18200) return 0;
    if (taxableIncome <= 45000) return (taxableIncome - 18200) * 0.16;
    if (taxableIncome <= 135000) return 4288 + (taxableIncome - 45000) * 0.30;
    if (taxableIncome <= 190000) return 31288 + (taxableIncome - 135000) * 0.37;
    return 51638 + (taxableIncome - 190000) * 0.45;
  }

  function calculateMedicareLevy(taxableIncome: number): number {
    if (taxableIncome <= 26000) return 0; // Phase-in threshold
    if (taxableIncome <= 32500) return (taxableIncome - 26000) * 0.10; // Phase-in rate
    return taxableIncome * 0.02;
  }

  const taxEstimates = familyMembers.map(member => {
    const grossIncome = member.salary;
    // Split deductions evenly across members for now (simplified)
    const deductions = totalDeductions / (familyMembers.length || 1);
    const taxableIncome = Math.max(0, grossIncome - deductions);
    const incomeTax = calculateTax(taxableIncome);
    const medicare = calculateMedicareLevy(taxableIncome);
    const totalTax = incomeTax + medicare;

    // Estimate PAYG withheld (tax on gross with no deductions)
    const paygWithheld = calculateTax(grossIncome) + calculateMedicareLevy(grossIncome);
    const estimatedRefund = paygWithheld - totalTax;
    const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;

    return {
      name: member.name,
      grossIncome,
      deductions,
      taxableIncome,
      incomeTax,
      medicare,
      totalTax,
      paygWithheld,
      estimatedRefund,
      effectiveRate,
    };
  });

  const totalFamilyRefund = taxEstimates.reduce((sum, e) => sum + e.estimatedRefund, 0);

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
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="page-header mb-0">Dashboard</h1>
      </div>

      {(() => {
        const groups: FilterGroup[] = [{
          id: 'fy',
          icon: 'fa-calendar',
          label: 'Financial Year',
          value: financialYear,
          onChange: (v: string) => setFinancialYear(v),
          options: [
            { value: '2025-2026', label: 'FY 2025-2026' },
            { value: '2024-2025', label: 'FY 2024-2025' },
            { value: '2023-2024', label: 'FY 2023-2024' },
          ],
        }];
        return <PageFilters groups={groups} className="mb-3" />;
      })()}

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

      <BudgetsWidget />

      {(tips.length > 0 || tipsLoading) && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-stethoscope me-2"></i>Dr Finance Says
              <span className="badge bg-teal ms-auto">Daily Tips</span>
            </div>
          </PanelHeader>
          <PanelBody>
            {tipsLoading ? (
              <div className="text-center py-3 text-muted">
                <i className="fa fa-spinner fa-spin me-2"></i>Dr Finance is reviewing your finances...
              </div>
            ) : (
              <div className="row">
                {tips.map((tip, i) => {
                  const colors = { tax: 'teal', investment: 'indigo', strategy: 'warning' };
                  const labels = { tax: 'Tax', investment: 'Portfolio', strategy: 'Strategy' };
                  const color = colors[tip.type] || 'secondary';
                  return (
                    <div key={i} className="col-md-4 mb-2 mb-md-0">
                      <div className={`d-flex align-items-start p-3 rounded bg-light h-100`}>
                        <div className={`text-${color} me-3 mt-1`}>
                          <i className={`fa ${tip.icon} fa-lg`}></i>
                        </div>
                        <div>
                          <span className={`badge bg-${color} mb-1`} style={{ fontSize: '0.65rem' }}>{labels[tip.type] || tip.type}</span>
                          <p className="mb-0 small">{tip.tip}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      {taxEstimates.length > 0 && (
        <Panel className="mb-3">
          <PanelHeader noButton>
            <div className="d-flex align-items-center">
              <i className="fa fa-calculator me-2"></i>Tax Estimate — FY {financialYear}
              {totalFamilyRefund > 0 && (
                <span className="badge bg-success ms-auto">
                  <i className="fa fa-arrow-down me-1"></i>Estimated refund: ${totalFamilyRefund.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              )}
              {totalFamilyRefund < 0 && (
                <span className="badge bg-danger ms-auto">
                  <i className="fa fa-arrow-up me-1"></i>Estimated owing: ${Math.abs(totalFamilyRefund).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </PanelHeader>
          <PanelBody>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="text-end">Gross Income</th>
                    <th className="text-end">Deductions</th>
                    <th className="text-end">Taxable Income</th>
                    <th className="text-end">Income Tax</th>
                    <th className="text-end">Medicare</th>
                    <th className="text-end">PAYG Withheld</th>
                    <th className="text-end">Est. Refund</th>
                    <th className="text-end">Effective Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {taxEstimates.map((est, i) => (
                    <tr key={i}>
                      <td className="fw-bold">{est.name}</td>
                      <td className="text-end">${est.grossIncome.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-teal">${est.deductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${est.taxableIncome.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${est.incomeTax.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${est.medicare.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-muted">${est.paygWithheld.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className={`text-end fw-bold ${est.estimatedRefund >= 0 ? 'text-success' : 'text-danger'}`}>
                        {est.estimatedRefund >= 0 ? '+' : ''}{est.estimatedRefund.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-end text-muted">{est.effectiveRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                {taxEstimates.length > 1 && (
                  <tfoot>
                    <tr className="fw-bold">
                      <td>Total</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.grossIncome, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-teal">${totalDeductions.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.taxableIncome, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.incomeTax, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end">${taxEstimates.reduce((s, e) => s + e.medicare, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className="text-end text-muted">${taxEstimates.reduce((s, e) => s + e.paygWithheld, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                      <td className={`text-end ${totalFamilyRefund >= 0 ? 'text-success' : 'text-danger'}`}>
                        {totalFamilyRefund >= 0 ? '+' : ''}{totalFamilyRefund.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="text-muted small mt-2 mb-0">
              <i className="fa fa-info-circle me-1"></i>
              Estimate based on FY {financialYear} tax rates. PAYG assumes standard withholding on gross salary. Deductions split evenly across members. This is not tax advice — consult your accountant.
            </p>
          </PanelBody>
        </Panel>
      )}

      {familyMembers.length === 0 && expenses.length > 0 && (
        <div className="alert alert-info mb-3">
          <i className="fa fa-info-circle me-2"></i>
          <Link href="/cashflow" className="alert-link">Add family members</Link> with their salaries to see a personalised tax estimate on the dashboard.
        </div>
      )}

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
                  <p className="mb-2">No expenses tracked for FY {financialYear}</p>
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
