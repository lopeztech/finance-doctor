'use client';

import { useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';

const CATEGORIES = [
  'Work from Home',
  'Vehicle & Travel',
  'Clothing & Laundry',
  'Self-Education',
  'Tools & Equipment',
  'Professional Memberships',
  'Phone & Internet',
  'Donations',
  'Investment Expenses',
  'Investment Property',
  'Other Deductions',
];

const SPENDING_CATEGORIES = [
  'Groceries',
  'Dining & Takeaway',
  'Transport',
  'Utilities & Bills',
  'Shopping',
  'Healthcare',
  'Entertainment',
  'Subscriptions',
  'Education',
  'Insurance',
  'Home & Garden',
  'Personal Care',
  'Travel & Holidays',
  'Gifts & Donations',
  'Financial & Banking',
  'Cafe',
  'Bakery',
  'Car',
  'Personal Project',
  'Kids Entertainment',
  'Other',
];

export default function CategoryReference() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Panel className="mb-3">
      <PanelHeader noButton>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span><i className="fa fa-tags me-2"></i>Available categories for the <code>Category</code> column</span>
          <button className="btn btn-sm btn-outline-secondary ms-sm-auto" onClick={() => setExpanded(v => !v)}>
            {expanded ? <><i className="fa fa-chevron-up me-1"></i>Hide</> : <><i className="fa fa-chevron-down me-1"></i>Show</>}
          </button>
        </div>
      </PanelHeader>
      {expanded && (
        <PanelBody>
          <p className="text-muted small mb-3">
            Use any of these values in your CSV&apos;s <code>Category</code> column. The importer matches case-insensitively. Tax values set the ATO deduction category; spending values set the budget category. Anything not on these lists is treated as a custom spending category.
          </p>
          <div className="row">
            <div className="col-md-6 mb-3">
              <h6 className="fw-bold mb-2"><i className="fa fa-file-invoice-dollar me-2 text-teal"></i>Tax categories</h6>
              <div className="small text-muted mb-2">Sets the ATO deduction bucket. Non-deductible rows are forced into <em>Other Deductions</em>.</div>
              <ul className="list-unstyled mb-0">
                {CATEGORIES.map(c => (
                  <li key={c} className="mb-1">
                    <span className="badge bg-light text-dark border">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-md-6 mb-3">
              <h6 className="fw-bold mb-2"><i className="fa fa-wallet me-2 text-indigo"></i>Spending categories</h6>
              <div className="small text-muted mb-2">Sets the budget bucket for the Expenses view. Any label not on this list becomes a custom spending category.</div>
              <ul className="list-unstyled mb-0">
                {SPENDING_CATEGORIES.map(c => (
                  <li key={c} className="mb-1">
                    <span className="badge bg-light text-dark border">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="alert alert-info mb-0 small">
            <i className="fa fa-circle-info me-2"></i>
            <strong>Tax Deductible</strong> column accepts <code>TRUE/FALSE</code>, <code>Yes/No</code>, <code>Y/N</code>, <code>1/0</code>, <code>deductible</code>/<code>non-deductible</code>. Blank means &quot;let Dr Finance decide&quot;.
          </div>
        </PanelBody>
      )}
    </Panel>
  );
}
