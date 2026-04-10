'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, FamilyMember } from '@/lib/types';

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
  'Other Deductions',
];

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

interface ImportRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  financialYear: string;
  owner?: string;
  duplicate?: boolean;
}

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

export default function UploadPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  // CSV import
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);
  const [importDuplicateCount, setImportDuplicateCount] = useState(0);
  const [importSaving, setImportSaving] = useState(false);
  const [importDefaultOwner, setImportDefaultOwner] = useState('');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/expenses?fy=all');
    if (res.ok) setExpenses(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetch('/api/family-members').then(r => r.ok ? r.json() : []).then(setFamilyMembers);
  }, [fetchExpenses]);

  // CSV import handlers
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportPreview(null);
    setImportDuplicateCount(0);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/expenses/import', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      setImportDuplicateCount(data.duplicateCount || 0);
      // Apply default owner to all non-duplicate rows
      const preview = data.preview.map((row: ImportRow) => ({
        ...row,
        owner: row.duplicate ? undefined : importDefaultOwner,
      }));
      setImportPreview(preview);
    } else {
      const err = await res.json().catch(() => ({ error: 'Import failed' }));
      alert(err.error || 'Import failed');
    }
    setImportLoading(false);
    e.target.value = '';
  };

  const updatePreviewCategory = (index: number, category: string) => {
    setImportPreview(prev => prev ? prev.map((item, i) => i === index ? { ...item, category } : item) : null);
  };

  const updatePreviewOwner = (index: number, owner: string) => {
    setImportPreview(prev => prev ? prev.map((item, i) => i === index ? { ...item, owner } : item) : null);
  };

  const removePreviewRow = (index: number) => {
    setImportPreview(prev => prev ? prev.filter((_, i) => i !== index) : null);
  };

  const confirmImport = async () => {
    const toSave = importPreview?.filter(r => !r.duplicate);
    if (!toSave?.length) return;
    setImportSaving(true);
    const res = await fetch('/api/expenses/import', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses: toSave }),
    });
    if (res.ok) {
      setImportPreview(null);
      setShowImport(false);
      // Refetch to pick up all imported expenses (may span multiple FYs)
      fetchExpenses();
    }
    setImportSaving(false);
  };

  return (
    <>
      <h1 className="page-header">Upload & Manage</h1>

      <Panel className="mb-3">
        <PanelHeader noButton>
          <div className="d-flex align-items-center">
            <i className="fa fa-file-csv me-2"></i>Import CSV
            <button className="btn btn-sm btn-outline-primary ms-auto" onClick={() => { setShowImport(!showImport); setImportPreview(null); }}>
              {showImport ? <><i className="fa fa-times me-1"></i>Close</> : <><i className="fa fa-upload me-1"></i>Import</>}
            </button>
          </div>
        </PanelHeader>
        {showImport && (
          <PanelBody>
            <p className="text-muted small mb-3">Upload a CSV with Date, Amount, Description columns. Financial year is auto-detected from each expense date. Dr Finance will auto-categorise using AI.</p>

            {!importPreview ? (
              <div className="d-flex align-items-center gap-3">
                {familyMembers.length > 0 && (
                  <div>
                    <label className="form-label text-muted small mb-1">Default owner</label>
                    <select className="form-select form-select-sm" value={importDefaultOwner} onChange={e => setImportDefaultOwner(e.target.value)} style={{ width: '200px' }}>
                      <option value="">Unassigned</option>
                      {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="d-flex align-items-end">
                  <label className="btn btn-outline-primary" htmlFor="csv-upload">
                    {importLoading ? <><i className="fa fa-spinner fa-spin me-1"></i>Analysing...</> : <><i className="fa fa-upload me-1"></i>Choose File</>}
                  </label>
                  <input id="csv-upload" type="file" accept=".csv" className="d-none" onChange={handleImportFile} disabled={importLoading} />
                </div>
              </div>
            ) : (
              <>
                <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                  <span className="badge bg-teal">{importPreview.filter(r => !r.duplicate).length} new</span>
                  {importDuplicateCount > 0 && (
                    <span className="badge bg-warning text-dark"><i className="fa fa-copy me-1"></i>{importDuplicateCount} duplicates skipped</span>
                  )}
                  <span className="text-muted small">Review categories and owners, then confirm.</span>
                  <button className="btn btn-sm btn-success ms-auto me-2" onClick={confirmImport} disabled={importSaving || importPreview.filter(r => !r.duplicate).length === 0}>
                    {importSaving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving...</> : <><i className="fa fa-check me-1"></i>Confirm Import ({importPreview.filter(r => !r.duplicate).length})</>}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setImportPreview(null)}>
                    <i className="fa fa-times me-1"></i>Cancel
                  </button>
                </div>
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="sticky-top bg-light">
                      <tr>
                        <th></th>
                        <th>Date</th>
                        <th>FY</th>
                        <th>Description</th>
                        <th className="text-end">Amount</th>
                        <th>Category (AI)</th>
                        <th>Owner</th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} className={row.duplicate ? 'text-muted' : ''} style={row.duplicate ? { opacity: 0.5 } : undefined}>
                          <td>
                            {row.duplicate && <span className="badge bg-warning text-dark" title="Already exists"><i className="fa fa-copy"></i></span>}
                          </td>
                          <td className="small">{new Date(row.date).toLocaleDateString('en-AU')}</td>
                          <td className="small text-muted">{row.financialYear}</td>
                          <td className="small">{row.description}</td>
                          <td className="text-end small">${row.amount.toFixed(2)}</td>
                          <td>
                            {row.duplicate ? (
                              <span className="small text-muted">Duplicate</span>
                            ) : (
                              <select className="form-select form-select-sm" value={row.category} onChange={e => updatePreviewCategory(i, e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            )}
                          </td>
                          <td>
                            {!row.duplicate && familyMembers.length > 0 && (
                              <select className="form-select form-select-sm" value={row.owner || ''} onChange={e => updatePreviewOwner(i, e.target.value)}>
                                <option value="">Unassigned</option>
                                {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                              </select>
                            )}
                          </td>
                          <td>
                            {!row.duplicate && (
                              <button className="btn btn-xs btn-outline-danger" onClick={() => removePreviewRow(i)} title="Remove">
                                <i className="fa fa-times"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </PanelBody>
        )}
      </Panel>

      {loading ? (
        <div className="text-center py-5"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      ) : expenses.length > 0 && (
        <div className="alert alert-success">
          <i className="fa fa-check-circle me-2"></i>
          <strong>{expenses.length}</strong> expenses uploaded. View them in <a href="/tax" className="alert-link">Tax</a> or <a href="/expenses" className="alert-link">Expenses</a>.
        </div>
      )}
    </>
  );
}
