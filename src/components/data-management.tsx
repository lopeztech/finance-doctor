'use client';

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { Expense, FamilyMember } from '@/lib/types';
import {
  importPreview as callImportPreview,
  importSave as callImportSave,
  cashflowImportPreview as callCashflowPreview,
  cashflowImportSave as callCashflowSave,
  migrateFix,
  migrateCategorise,
  type MigrateFixResult,
  type CashflowPreviewRow,
  type CashflowImportSaveResponse,
} from '@/lib/functions-client';
import { listExpenses, watchPendingCategorisation } from '@/lib/expenses-repo';
import { listFamilyMembers } from '@/lib/family-members-repo';
import ReceiptScan from '@/components/receipt-scan';

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
  const [importLoading, setImportLoading] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportRow[] | null>(null);
  const [importDuplicateCount, setImportDuplicateCount] = useState(0);
  const [importDeferredCount, setImportDeferredCount] = useState(0);
  const [importSaving, setImportSaving] = useState(false);
  const [importOwner, setImportOwner] = useState('');
  const [importType, setImportType] = useState<'expenses' | 'cashflow'>('expenses');
  const [cashflowPreview, setCashflowPreview] = useState<CashflowPreviewRow[] | null>(null);
  const [cashflowDuplicateCount, setCashflowDuplicateCount] = useState(0);
  const [cashflowErrorCount, setCashflowErrorCount] = useState(0);
  const [cashflowResult, setCashflowResult] = useState<CashflowImportSaveResponse | null>(null);
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
    setCashflowPreview(null);
    setImportDuplicateCount(0);
    setCashflowResult(null);
    try {
      const csvText = await file.text();
      if (importType === 'cashflow') {
        const data = await callCashflowPreview(csvText, importOwner || undefined);
        setCashflowPreview(data.preview);
        setCashflowDuplicateCount(data.duplicateCount);
        setCashflowErrorCount(data.errorCount);
      } else {
        const data = await callImportPreview(csvText);
        setImportDuplicateCount(data.duplicateCount || 0);
        setImportDeferredCount(data.deferredCategorisation || 0);
        setImportPreviewRows(data.preview);
      }
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

  const removeCashflowRow = (index: number) => {
    setCashflowPreview(prev => prev ? prev.filter((_, i) => i !== index) : null);
  };
  const updateCashflowType = (index: number, type: CashflowPreviewRow['type']) => {
    setCashflowPreview(prev => prev ? prev.map((r, i) => i === index ? { ...r, type, error: r.error?.startsWith('Unknown Type') ? undefined : r.error } : r) : null);
  };

  const confirmCashflowImport = async () => {
    if (!cashflowPreview) return;
    const toSave = cashflowPreview
      .filter(r => !r.duplicate && !r.error)
      .map(r => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        financialYear: r.financialYear,
        ...(r.owner ? { owner: r.owner } : {}),
      }));
    if (!toSave.length) return;
    setImportSaving(true);
    setCashflowResult(null);
    try {
      const result = await callCashflowSave(toSave);
      setCashflowResult(result);
      setCashflowPreview(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cashflow import failed');
    }
    setImportSaving(false);
  };

  const newCount = importPreviewRows?.filter(r => !r.duplicate).length || 0;
  const cashflowNewCount = cashflowPreview?.filter(r => !r.duplicate && !r.error).length || 0;

  return (
    <>
      <ReceiptScan familyMembers={familyMembers} onSaved={fetchExpenses} />

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
            {importType === 'expenses' ? (
              <p className="text-muted small mb-3">
                Upload a CSV with <strong>Date</strong>, <strong>Amount</strong>, <strong>Description</strong> columns. Financial year is auto-detected from each expense date.
                {' '}Optional columns: <strong>Category</strong> (a tax category like &quot;Work from Home&quot;, a spending category like &quot;Groceries&quot;, or any custom label) and <strong>Tax Deductible</strong> (TRUE/FALSE, Yes/No, or 1/0).
                {' '}Dr Finance will auto-categorise anything you don&apos;t fill in using AI.
              </p>
            ) : (
              <p className="text-muted small mb-3">
                Upload a CSV with <strong>Date</strong>, <strong>Amount</strong>, <strong>Description</strong>, <strong>Type</strong> columns. Financial year is auto-detected from each date. <strong>Type</strong> must be one of <code>Salary</code>, <code>Dividend</code>, <code>Interest</code>, <code>Side Income</code>, <code>Other Income</code>, or <code>Rental</code>. Owner is applied from the dropdown below to every row. See the Cashflow CSV reference below for full details.
              </p>
            )}

            {cashflowResult && (
              <div className="alert alert-success py-2 small mb-3" role="alert">
                <i className="fa fa-check-circle me-2"></i>
                Saved <strong>{cashflowResult.saved.length}</strong> income row{cashflowResult.saved.length === 1 ? '' : 's'}.
              </div>
            )}

            {!importPreviewRows && !cashflowPreview ? (
              <div className="d-flex flex-wrap align-items-end gap-3">
                <div>
                  <label className="form-label text-muted small mb-1">File type</label>
                  <select className="form-select form-select-sm" value={importType} onChange={e => setImportType(e.target.value as 'expenses' | 'cashflow')} style={{ width: '180px' }} disabled={importLoading}>
                    <option value="expenses">Expenses CSV</option>
                    <option value="cashflow">Cashflow CSV</option>
                  </select>
                </div>
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
            ) : cashflowPreview ? (
              <>
                <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                  <span className="badge bg-teal">{cashflowNewCount} new</span>
                  {cashflowDuplicateCount > 0 && (
                    <span className="badge bg-warning text-dark"><i className="fa fa-copy me-1"></i>{cashflowDuplicateCount} duplicates skipped</span>
                  )}
                  {cashflowErrorCount > 0 && (
                    <span className="badge bg-danger"><i className="fa fa-triangle-exclamation me-1"></i>{cashflowErrorCount} errored</span>
                  )}
                  {importOwner && <span className="badge bg-primary"><i className="fa fa-user me-1"></i>{importOwner}</span>}
                  <span className="text-muted small">Review, then confirm.</span>
                  <button className="btn btn-sm btn-success ms-auto me-2" onClick={confirmCashflowImport} disabled={importSaving || cashflowNewCount === 0}>
                    {importSaving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving...</> : <><i className="fa fa-check me-1"></i>Confirm Import ({cashflowNewCount})</>}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => { setCashflowPreview(null); setCashflowResult(null); }}>
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
                        <th>Type</th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashflowPreview.map((row, i) => {
                        const dim = row.duplicate || row.error;
                        return (
                          <tr key={i} className={dim ? 'text-muted' : ''} style={dim ? { opacity: 0.55 } : undefined}>
                            <td>
                              {row.duplicate && <span className="badge bg-warning text-dark me-1" title="Already exists"><i className="fa fa-copy"></i></span>}
                              {row.error && <span className="badge bg-danger" title={row.error}><i className="fa fa-triangle-exclamation"></i></span>}
                            </td>
                            <td className="small">{row.date ? new Date(row.date).toLocaleDateString('en-AU') : '—'}</td>
                            <td className="small text-muted">{row.financialYear || '—'}</td>
                            <td className="small">{row.description || '—'}</td>
                            <td className="text-end small">{row.amount ? `$${row.amount.toFixed(2)}` : '—'}</td>
                            <td>
                              {row.duplicate || row.error ? (
                                <span className="small text-muted">{row.error || 'Duplicate'}</span>
                              ) : (
                                <select className="form-select form-select-sm" value={row.type} onChange={e => updateCashflowType(i, e.target.value as CashflowPreviewRow['type'])}>
                                  {(['Salary', 'Dividend', 'Interest', 'Side Income', 'Other Income', 'Rental'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              )}
                            </td>
                            <td>
                              {!row.duplicate && (
                                <button className="btn btn-xs btn-outline-danger" onClick={() => removeCashflowRow(i)} title="Remove">
                                  <i className="fa fa-times"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : importPreviewRows ? (
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
            ) : null}
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
