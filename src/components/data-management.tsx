'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, FamilyMember } from '@/lib/types';
import { importPreview as callImportPreview, importSave as callImportSave, migrateFix, migrateCategorise, type MigrateFixResult } from '@/lib/functions-client';
import { listExpenses, watchPendingCategorisation } from '@/lib/expenses-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';

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

interface ImportRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
  financialYear: string;
  owner?: string;
  duplicate?: boolean;
  awaitingCategorisation?: boolean;
}

export default function DataManagement() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showCategoryRef, setShowCategoryRef] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportRow[] | null>(null);
  const [importDuplicateCount, setImportDuplicateCount] = useState(0);
  const [importDeferredCount, setImportDeferredCount] = useState(0);
  const [importSaving, setImportSaving] = useState(false);
  const [importOwner, setImportOwner] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<MigrateFixResult | null>(null);
  const [categorising, setCategorising] = useState(false);
  const [categoriseProgress, setCategoriseProgress] = useState({ done: 0, remaining: 0 });
  const [pendingCounts, setPendingCounts] = useState({ pending: 0, failed: 0 });

  useEffect(() => {
    const unsub = watchPendingCategorisation(setPendingCounts);
    return () => unsub();
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await listExpenses('all'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    listFamilyMembers().then(setFamilyMembers).catch(() => setFamilyMembers([]));
  }, [fetchExpenses]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportPreviewRows(null);
    setImportDuplicateCount(0);
    try {
      const csvText = await file.text();
      const data = await callImportPreview(csvText);
      setImportDuplicateCount(data.duplicateCount || 0);
      setImportDeferredCount(data.deferredCategorisation || 0);
      setImportPreviewRows(data.preview);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    }
    setImportLoading(false);
    e.target.value = '';
  };

  const updatePreviewCategory = (index: number, category: string) => {
    setImportPreviewRows(prev => prev ? prev.map((item, i) => i === index ? { ...item, category } : item) : null);
  };

  const removePreviewRow = (index: number) => {
    setImportPreviewRows(prev => prev ? prev.filter((_, i) => i !== index) : null);
  };

  const confirmImport = async () => {
    const toSave = importPreviewRows?.filter(r => !r.duplicate).map(r => ({
      date: r.date,
      description: r.description,
      amount: r.amount,
      category: r.category,
      ...(r.spendingCategory ? { spendingCategory: r.spendingCategory } : {}),
      ...(r.spendingSubCategory ? { spendingSubCategory: r.spendingSubCategory } : {}),
      ...(r.nonDeductible ? { nonDeductible: true } : {}),
      financialYear: r.financialYear,
      ...(importOwner ? { owner: importOwner } : {}),
      ...(r.awaitingCategorisation ? { awaitingCategorisation: true } : {}),
    }));
    if (!toSave?.length) return;
    setImportSaving(true);
    try {
      await callImportSave(toSave);
      setImportPreviewRows(null);
      setImportDeferredCount(0);
      setShowImport(false);
      fetchExpenses();
    } catch {}
    setImportSaving(false);
  };

  const newCount = importPreviewRows?.filter(r => !r.duplicate).length || 0;

  return (
    <>
      <Panel className="mb-3">
        <PanelHeader noButton>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span><i className="fa fa-file-csv me-2"></i>Import CSV</span>
            <button className="btn btn-sm btn-outline-primary ms-sm-auto" onClick={() => { setShowImport(!showImport); setImportPreviewRows(null); }}>
              {showImport ? <><i className="fa fa-times me-1"></i>Close</> : <><i className="fa fa-upload me-1"></i>Import</>}
            </button>
          </div>
        </PanelHeader>
        {showImport && (
          <PanelBody>
            <p className="text-muted small mb-3">
              Upload a CSV with <strong>Date</strong>, <strong>Amount</strong>, <strong>Description</strong> columns. Financial year is auto-detected from each expense date.
              {' '}Optional columns: <strong>Category</strong> (a tax category like &quot;Work from Home&quot;, a spending category like &quot;Groceries&quot;, or any custom label) and <strong>Tax Deductible</strong> (TRUE/FALSE, Yes/No, or 1/0).
              {' '}Dr Finance will auto-categorise anything you don&apos;t fill in using AI.
            </p>

            {!importPreviewRows ? (
              <div className="d-flex flex-wrap align-items-end gap-3">
                {familyMembers.length > 0 && (
                  <div>
                    <label className="form-label text-muted small mb-1">Owner</label>
                    <select className="form-select form-select-sm" value={importOwner} onChange={e => setImportOwner(e.target.value)} style={{ width: '200px' }}>
                      <option value="">Unassigned</option>
                      {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="btn btn-outline-primary" htmlFor="csv-upload">
                    {importLoading ? <><i className="fa fa-spinner fa-spin me-1"></i>Analysing...</> : <><i className="fa fa-upload me-1"></i>Choose File</>}
                  </label>
                  <input id="csv-upload" type="file" accept=".csv" className="d-none" onChange={handleImportFile} disabled={importLoading} />
                </div>
              </div>
            ) : (
              <>
                <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                  <span className="badge bg-teal">{newCount} new</span>
                  {importDuplicateCount > 0 && (
                    <span className="badge bg-warning text-dark"><i className="fa fa-copy me-1"></i>{importDuplicateCount} duplicates skipped</span>
                  )}
                  {importDeferredCount > 0 && (
                    <span className="badge bg-info text-dark" title="Large imports categorise in the background after save">
                      <i className="fa fa-clock me-1"></i>{importDeferredCount} will auto-categorise
                    </span>
                  )}
                  {importOwner && <span className="badge bg-primary"><i className="fa fa-user me-1"></i>{importOwner}</span>}
                  <span className="text-muted small">Review categories, then confirm.</span>
                  <button className="btn btn-sm btn-success ms-auto me-2" onClick={confirmImport} disabled={importSaving || newCount === 0}>
                    {importSaving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving...</> : <><i className="fa fa-check me-1"></i>Confirm Import ({newCount})</>}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setImportPreviewRows(null)}>
                    <i className="fa fa-times me-1"></i>Cancel
                  </button>
                </div>
                {importDeferredCount > 0 && (
                  <div className="alert alert-info py-2 small mb-2">
                    <i className="fa fa-circle-info me-1"></i>
                    This import is large enough that {importDeferredCount} rows will be categorised in the background after save. Rows marked below as &quot;pending&quot; will update automatically once Dr Finance has processed them.
                  </div>
                )}
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="sticky-top bg-light">
                      <tr>
                        <th></th>
                        <th>Date</th>
                        <th>FY</th>
                        <th>Description</th>
                        <th className="text-end">Amount</th>
                        <th>Tax Category</th>
                        <th>Spending</th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((row, i) => (
                        <tr key={i} className={row.duplicate ? 'text-muted' : ''} style={row.duplicate ? { opacity: 0.5 } : undefined}>
                          <td>
                            {row.duplicate && <span className="badge bg-warning text-dark" title="Already exists"><i className="fa fa-copy"></i></span>}
                            {row.nonDeductible && !row.duplicate && <span className="badge bg-danger ms-1" title="Non-deductible"><i className="fa fa-ban"></i></span>}
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
                          <td className="small text-muted">
                            {row.awaitingCategorisation
                              ? <span className="badge bg-light text-muted border"><i className="fa fa-clock me-1"></i>pending</span>
                              : (row.spendingCategory || '—')}
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

      <Panel className="mb-3">
        <PanelHeader noButton>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span><i className="fa fa-tags me-2"></i>Available categories for the <code>Category</code> column</span>
            <button className="btn btn-sm btn-outline-secondary ms-sm-auto" onClick={() => setShowCategoryRef(!showCategoryRef)}>
              {showCategoryRef ? <><i className="fa fa-chevron-up me-1"></i>Hide</> : <><i className="fa fa-chevron-down me-1"></i>Show</>}
            </button>
          </div>
        </PanelHeader>
        {showCategoryRef && (
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

      {(pendingCounts.pending > 0 || pendingCounts.failed > 0) && (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2">
          <i className="fa fa-robot"></i>
          <div className="flex-grow-1">
            {pendingCounts.pending > 0 && (
              <>
                <i className="fa fa-spinner fa-spin me-1"></i>
                <strong>{pendingCounts.pending}</strong> expense{pendingCounts.pending === 1 ? '' : 's'} still being categorised in the background.
              </>
            )}
            {pendingCounts.failed > 0 && (
              <span className="ms-2 text-danger">
                <i className="fa fa-triangle-exclamation me-1"></i>
                <strong>{pendingCounts.failed}</strong> failed — re-run the categoriser from Settings to retry.
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-3"><i className="fa fa-spinner fa-spin fa-2x"></i></div>
      ) : expenses.length > 0 && (
        <div className="alert alert-success d-flex flex-wrap align-items-center gap-2">
          <div className="flex-grow-1">
            <i className="fa fa-check-circle me-2"></i>
            <strong>{expenses.length}</strong> expenses stored. View them in <a href="/tax" className="alert-link">Tax</a> or <a href="/expenses" className="alert-link">Expenses</a>.
          </div>
          <button
            className="btn btn-sm btn-outline-dark"
            disabled={migrating}
            onClick={async () => {
              setMigrating(true);
              setMigrateResult(null);
              try {
                const data = await migrateFix();
                setMigrateResult(data);
                if (data.fixed > 0) fetchExpenses();
              } catch {}
              setMigrating(false);
            }}
          >
            {migrating ? <><i className="fa fa-spinner fa-spin me-1"></i>Fixing...</> : <><i className="fa fa-wrench me-1"></i>Fix Data</>}
          </button>
        </div>
      )}

      {migrateResult && (
        <div className="alert alert-info">
          <i className="fa fa-info-circle me-2"></i>
          Scanned <strong>{migrateResult.total}</strong> expenses:
          {migrateResult.addedFY > 0 && <span className="ms-2"><strong>{migrateResult.addedFY}</strong> FY backfilled.</span>}
          {migrateResult.setOwner > 0 && <span className="ms-2"><strong>{migrateResult.setOwner}</strong> owner set to Josh.</span>}
          {migrateResult.fixed === 0 && <span className="ms-2">All fields up to date.</span>}
          {migrateResult.needsCategorisation > 0 && (
            <span className="ms-2">
              <strong>{migrateResult.needsCategorisation}</strong> expenses need AI categorisation.
              <button
                className="btn btn-sm btn-primary ms-2"
                disabled={categorising}
                onClick={async () => {
                  setCategorising(true);
                  let totalDone = 0;
                  let remaining = migrateResult.needsCategorisation;
                  setCategoriseProgress({ done: 0, remaining });
                  while (remaining > 0) {
                    try {
                      const data = await migrateCategorise(50);
                      totalDone += data.categorised;
                      remaining = data.remaining;
                      setCategoriseProgress({ done: totalDone, remaining });
                      if (data.remaining === 0 || (data.categorised === 0 && data.ruleApplied === 0)) break;
                    } catch {
                      break;
                    }
                  }
                  setCategorising(false);
                  fetchExpenses();
                }}
              >
                {categorising
                  ? <><i className="fa fa-spinner fa-spin me-1"></i>{categoriseProgress.done} done, {categoriseProgress.remaining} left...</>
                  : <><i className="fa fa-robot me-1"></i>Categorise Now</>}
              </button>
            </span>
          )}
          {migrateResult.needsCategorisation === 0 && !categorising && categoriseProgress.done === 0 && (
            <span className="ms-2">All categories assigned.</span>
          )}
        </div>
      )}

      {categoriseProgress.done > 0 && !categorising && (
        <div className="alert alert-success">
          <i className="fa fa-check-circle me-2"></i>
          AI categorised <strong>{categoriseProgress.done}</strong> expenses into tax and spending categories.
        </div>
      )}
    </>
  );
}
