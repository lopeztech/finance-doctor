'use client';

import { useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { INCOME_TYPES } from '@/lib/types';

const EXAMPLE = `Date,Amount,Description,Type
2026-03-14,4615.38,Employer payrun,Salary
2026-03-21,4615.38,Employer payrun,Salary
2026-02-28,812.50,VAS dividend,Dividend
2026-02-01,2600.00,42 Moreland St rent,Rental
2026-01-15,420.00,ING Maximiser interest,Interest
2026-01-05,500.00,Freelance design — Stripe payout,Side Income
2025-12-18,1200.00,ATO tax refund,Other Income`;

export default function CashflowReference() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Panel className="mb-3">
      <PanelHeader noButton>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span><i className="fa fa-sack-dollar me-2"></i>Cashflow CSV — available <code>Type</code> values</span>
          <button className="btn btn-sm btn-outline-secondary ms-sm-auto" onClick={() => setExpanded(v => !v)}>
            {expanded ? <><i className="fa fa-chevron-up me-1"></i>Hide</> : <><i className="fa fa-chevron-down me-1"></i>Show</>}
          </button>
        </div>
      </PanelHeader>
      {expanded && (
        <PanelBody>
          <p className="text-muted small mb-3">
            Upload from <strong>Data Management → Import CSV → Cashflow CSV</strong>. The importer expects four columns: <strong>Date</strong>, <strong>Amount</strong>, <strong>Description</strong>, and <strong>Type</strong>. Financial year is auto-detected from each date (AU FY starts 1 July). Owner is applied from the dropdown at upload time to every row. Rows are deduped by date + description + amount + owner.
          </p>

          <h6 className="fw-bold small mb-2"><i className="fa fa-tags me-1 text-teal"></i>Allowed <code>Type</code> values</h6>
          <div className="mb-3">
            {INCOME_TYPES.map(t => (
              <span key={t} className="badge bg-light text-dark border me-1 mb-1">{t}</span>
            ))}
          </div>
          <p className="text-muted small mb-3">
            Matching is case-insensitive. Common aliases (<code>wages</code>, <code>dividends</code>, <code>rent</code>, <code>side</code>) are accepted too. Rows with an unknown Type can have their Type fixed inline in the preview table before confirming.
          </p>

          <h6 className="fw-bold small mb-2"><i className="fa fa-calendar-day me-1 text-indigo"></i><code>Date</code> formats</h6>
          <div className="mb-3">
            {['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY'].map(f => (
              <span key={f} className="badge bg-light text-dark border me-1 mb-1">{f}</span>
            ))}
          </div>

          <h6 className="fw-bold small mb-2"><i className="fa fa-file-csv me-1 text-teal"></i>Example</h6>
          <pre className="bg-light border rounded p-2 small mb-3" style={{ fontSize: '0.75rem', overflowX: 'auto' }}>{EXAMPLE}</pre>

          <div className="alert alert-info mb-0 small">
            <i className="fa fa-circle-info me-2"></i>
            Each row is a <strong>single income event</strong> (a payrun, a dividend hit, a rent receipt), not a recurring rate. Import as many rows as you like — Cashflow views aggregate them across the period.
          </div>
        </PanelBody>
      )}
    </Panel>
  );
}
