'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { listExpenses } from '@/lib/expenses-repo';
import { listInvestments } from '@/lib/investments-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';
import {
  activeEofyFinancialYear,
  checklistCompletion,
  daysUntilEofyEnd,
  daysUntilLodgement,
  evaluateEofyChecklist,
  type ChecklistItem,
} from '@/lib/eofy';
import type { Expense, FamilyMember, Investment } from '@/lib/types';

function formatDayCount(days: number, label: string): string {
  if (days === 0) return `Today: ${label}`;
  if (days === 1) return `1 day until ${label}`;
  return `${days} days until ${label}`;
}

export default function EofyPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fy = activeEofyFinancialYear();

  useEffect(() => {
    Promise.all([
      listExpenses('all').catch(() => []),
      listInvestments().catch(() => []),
      listFamilyMembers().catch(() => []),
    ])
      .then(([exp, inv, fam]) => { setExpenses(exp); setInvestments(inv); setMembers(fam); })
      .finally(() => setLoading(false));
  }, []);

  const checklist = useMemo<ChecklistItem[]>(() => {
    const fyExpenses = expenses.filter(e => e.financialYear === fy);
    const wfhClaimantIds = members
      .filter(m => fyExpenses.some(e => e.category === 'Work from Home' && e.owner === m.name))
      .map(m => m.id);
    const vehicleLogbookSet = fyExpenses.some(e =>
      e.category === 'Vehicle & Travel' && Boolean(e.investmentId),
    );
    const dividendsImported = expenses.some(e => e.category === 'Investment Expenses' && e.financialYear === fy);
    const cgtReconciled = investments.some(i => typeof i.costBasis === 'number' && i.costBasis > 0);
    const superSalarySacrificeTotal = members.reduce((sum, m) => sum + (m.superSalarySacrifice || 0), 0);
    return evaluateEofyChecklist({
      financialYear: fy,
      expenses,
      wfhClaimantIds,
      // Without explicit hours-logged tracking, treat the presence of any WFH
      // claim as "logged" — replace with real tracking once the WFH calculator
      // ships.
      wfhHoursLoggedFor: wfhClaimantIds,
      vehicleLogbookSet,
      dividendsImported,
      cgtReconciled,
      superSalarySacrificeTotal,
    });
  }, [expenses, investments, members, fy]);

  const completion = checklistCompletion(checklist);
  const daysToEofy = daysUntilEofyEnd(fy);
  const daysToLodge = daysUntilLodgement(fy);

  return (
    <>
      <h1 className="page-header">EOFY checklist · FY {fy}</h1>

      <Panel className="mb-3">
        <PanelHeader noButton>
          <i className="fa fa-calendar-day me-2"></i>Countdown
        </PanelHeader>
        <PanelBody>
          <div className="row text-center">
            <div className="col-md-6 mb-3 mb-md-0">
              <div className="text-muted small">{formatDayCount(daysToEofy, '30 June (FY end)')}</div>
              <div className="display-6 fw-bold">{daysToEofy}</div>
            </div>
            <div className="col-md-6">
              <div className="text-muted small">{formatDayCount(daysToLodge, '31 Oct (self-lodgement deadline)')}</div>
              <div className="display-6 fw-bold">{daysToLodge}</div>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel className="mb-3">
        <PanelHeader noButton>
          <div className="d-flex align-items-center">
            <i className="fa fa-list-check me-2"></i>Checklist
            <span className="ms-auto text-muted small">
              {completion.done} of {completion.total} complete
              {completion.total > 0 && ` (${completion.pct}%)`}
            </span>
          </div>
        </PanelHeader>
        <PanelBody>
          {loading ? (
            <div className="text-muted small"><i className="fa fa-spinner fa-spin me-1"></i>Loading…</div>
          ) : (
            <ul className="list-group list-group-flush">
              {checklist.map(item => (
                <li key={item.id} className="list-group-item px-0 d-flex align-items-start gap-2">
                  <i className={`fa fa-fw mt-1 ${item.done ? 'fa-circle-check text-success' : 'fa-circle text-muted'}`}></i>
                  <div className="flex-grow-1">
                    <div className={item.done ? 'text-decoration-line-through text-muted' : ''}>{item.label}</div>
                    {item.detail && <small className="text-muted d-block">{item.detail}</small>}
                    {!item.done && item.hint && (
                      <small className="text-muted d-block">
                        {item.hint}{item.link && <> <Link href={item.link} className="text-decoration-none">Open</Link></>}
                      </small>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <Panel className="mb-3">
        <PanelHeader noButton>
          <i className="fa fa-magnifying-glass-dollar me-2"></i>Find missed deductions
        </PanelHeader>
        <PanelBody>
          <p className="small text-muted mb-2">
            Have Dr Finance scan your FY {fy} expenses for likely-deductible items you haven&apos;t
            claimed yet. Uses your existing AI advice settings — toggle in Settings → Privacy.
          </p>
          <Link href="/expenses?focus=advice" className="btn btn-sm btn-outline-primary">
            <i className="fa fa-robot me-1"></i>Open Dr Finance on the Expenses page
          </Link>
        </PanelBody>
      </Panel>
    </>
  );
}
