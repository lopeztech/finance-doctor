'use client';

import { useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';

interface TypeSpec {
  name: string;
  destination: string;
  required: string[];
  optional: string[];
  note: string;
}

const TYPES: TypeSpec[] = [
  {
    name: 'Salary',
    destination: 'Family members',
    required: ['Owner (member name)', 'Amount (annual)'],
    optional: ['Job', 'Super Salary Sacrifice (annual)'],
    note: 'Upserts by Owner. Cadence is implicitly annual and ignored.',
  },
  {
    name: 'Dividend',
    destination: 'Income sources',
    required: ['Description (e.g. VAS)', 'Amount', 'Cadence'],
    optional: ['Owner'],
    note: 'Creates one income source per row.',
  },
  {
    name: 'Interest',
    destination: 'Income sources',
    required: ['Description (e.g. ING Savings)', 'Amount', 'Cadence'],
    optional: ['Owner'],
    note: 'Creates one income source per row.',
  },
  {
    name: 'Side Income',
    destination: 'Income sources',
    required: ['Description', 'Amount', 'Cadence'],
    optional: ['Owner'],
    note: 'e.g. freelancing, consulting.',
  },
  {
    name: 'Other Income',
    destination: 'Income sources',
    required: ['Description', 'Amount', 'Cadence'],
    optional: ['Owner'],
    note: 'Catch-all for anything not covered by the types above.',
  },
  {
    name: 'Rental',
    destination: 'Existing property investment',
    required: ['Description (matches property address or name)', 'Amount'],
    optional: ['Cadence (defaults to monthly)'],
    note: 'Updates the property\'s rental income. Rows with no matching property are skipped.',
  },
];

const CADENCES = ['weekly', 'fortnightly', 'monthly', 'annual'];

const EXAMPLE = `Type,Owner,Description,Amount,Cadence,Job,Super Salary Sacrifice
Salary,Alex,,120000,annual,Software Engineer,5000
Salary,Sam,,95000,annual,Designer,
Dividend,Alex,VAS,800,annual,,
Interest,Joint,ING Maximiser,1400,annual,,
Side Income,Sam,Freelance design,500,monthly,,
Other Income,,Tax refund,1200,annual,,
Rental,,42 Moreland St,2600,monthly,,`;

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
            The Cashflow CSV uses a <code>Type</code> column to route each row to the right destination (family members, income sources, or an existing property). Upload it from <strong>Data Management → Import CSV → Cashflow CSV</strong>. The importer matches Type values case-insensitively.
          </p>

          <div className="table-responsive mb-3">
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '140px' }}>Type</th>
                  <th style={{ width: '180px' }}>Destination</th>
                  <th>Required columns</th>
                  <th>Optional columns</th>
                </tr>
              </thead>
              <tbody>
                {TYPES.map(t => (
                  <tr key={t.name}>
                    <td><span className="badge bg-light text-dark border">{t.name}</span></td>
                    <td className="small text-muted">{t.destination}</td>
                    <td className="small">
                      {t.required.map(r => <div key={r}>• {r}</div>)}
                    </td>
                    <td className="small text-muted">
                      {t.optional.length > 0 ? t.optional.map(o => <div key={o}>• {o}</div>) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h6 className="fw-bold small mb-2"><i className="fa fa-clock me-1 text-teal"></i>Cadence values</h6>
          <div className="mb-3">
            {CADENCES.map(c => (
              <span key={c} className="badge bg-light text-dark border me-1 mb-1">{c}</span>
            ))}
          </div>

          <h6 className="fw-bold small mb-2"><i className="fa fa-file-csv me-1 text-indigo"></i>Example</h6>
          <pre className="bg-light border rounded p-2 small mb-3" style={{ fontSize: '0.75rem', overflowX: 'auto' }}>{EXAMPLE}</pre>

          <div className="alert alert-info mb-0 small">
            <i className="fa fa-circle-info me-2"></i>
            <strong>Salaries</strong> are upserted by <code>Owner</code> name, so re-uploading the same CSV updates existing members rather than duplicating them. <strong>Income sources</strong> are deduped by (type + description + owner). <strong>Rental</strong> rows only apply when <code>Description</code> matches an existing property — otherwise they&apos;re skipped with a warning.
          </div>
        </PanelBody>
      )}
    </Panel>
  );
}
