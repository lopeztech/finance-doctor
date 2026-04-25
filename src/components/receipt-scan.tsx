'use client';

import { useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import type { FamilyMember } from '@/lib/types';
import { scanReceipt, type ReceiptScanResult } from '@/lib/functions-client';
import { addExpenses } from '@/lib/expenses-repo';

const TAX_CATEGORIES = [
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

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 5 * 1024 * 1024;

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) return '';
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('Unexpected reader result'));
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

interface DraftExpense {
  date: string;
  description: string;
  amount: string;
  category: string;
  owner: string;
  nonDeductible: boolean;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface Props {
  familyMembers: FamilyMember[];
  onSaved?: () => void;
}

export default function ReceiptScan({ familyMembers, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftExpense | null>(null);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDraft(null);
    setScanResult(null);
    setError(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setError(`Unsupported file type: ${file.type || 'unknown'}. Use JPEG, PNG, WEBP, or HEIC.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is ${MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }

    reset();
    setSavedMessage(null);
    setScanning(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const base64 = await fileToBase64(file);
      const result = await scanReceipt(base64, file.type);
      setScanResult(result);
      const ownerDefault = familyMembers.length === 1 ? familyMembers[0].name : '';
      setDraft({
        date: result.date || '',
        description: result.description || result.merchant || '',
        amount: typeof result.amount === 'number' ? result.amount.toFixed(2) : '',
        category: result.category || 'Other Deductions',
        owner: ownerDefault,
        nonDeductible: false,
        notes: result.notes,
        confidence: result.confidence,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receipt scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const updateDraft = <K extends keyof DraftExpense>(key: K, value: DraftExpense[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const canSave = draft && draft.date && draft.description.trim() && Number(draft.amount) > 0;

  const handleSave = async () => {
    if (!draft || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const fy = getFinancialYear(draft.date);
      if (!fy) throw new Error('Invalid date — use YYYY-MM-DD.');
      await addExpenses([{
        date: draft.date,
        description: draft.description.trim(),
        amount: Number(Number(draft.amount).toFixed(2)),
        category: draft.category,
        ...(scanResult?.spendingCategory ? { spendingCategory: scanResult.spendingCategory } : {}),
        ...(scanResult?.spendingSubCategory ? { spendingSubCategory: scanResult.spendingSubCategory } : {}),
        financialYear: fy,
        ...(draft.owner ? { owner: draft.owner } : {}),
        ...(draft.nonDeductible ? { nonDeductible: true } : {}),
      }]);
      setSavedMessage(`Saved $${Number(draft.amount).toFixed(2)} — ${draft.description.trim()}.`);
      reset();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="mb-3">
      <PanelHeader noButton>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span><i className="fa fa-camera me-2"></i>Scan Receipt</span>
          <button className="btn btn-sm btn-outline-primary ms-sm-auto" onClick={() => { setOpen(o => !o); reset(); setSavedMessage(null); }}>
            {open ? <><i className="fa fa-times me-1"></i>Close</> : <><i className="fa fa-camera me-1"></i>Scan</>}
          </button>
        </div>
      </PanelHeader>
      {open && (
        <PanelBody>
          <p className="text-muted small mb-3">
            Snap or upload a receipt photo and Dr Finance will read it. Review the extracted date, total, and category, then save as a single expense. Supports JPEG, PNG, WEBP, and HEIC up to {MAX_BYTES / 1024 / 1024} MB.
          </p>

          {savedMessage && (
            <div className="alert alert-success alert-dismissible py-2 small mb-3" role="alert">
              <i className="fa fa-check-circle me-1"></i>{savedMessage}
              <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setSavedMessage(null)}></button>
            </div>
          )}

          {error && (
            <div className="alert alert-danger alert-dismissible py-2 small mb-3" role="alert">
              <i className="fa fa-triangle-exclamation me-1"></i>{error}
              <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setError(null)}></button>
            </div>
          )}

          {!draft && !scanning && (
            <div>
              <label className="btn btn-outline-primary" htmlFor="receipt-upload">
                <i className="fa fa-upload me-1"></i>Choose Receipt
              </label>
              <input
                id="receipt-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                className="d-none"
                onChange={handleFile}
              />
            </div>
          )}

          {scanning && (
            <div className="d-flex align-items-center text-muted small">
              <i className="fa fa-spinner fa-spin me-2"></i>Reading the receipt with Dr Finance Vision...
            </div>
          )}

          {draft && !scanning && (
            <div className="row g-3">
              <div className="col-md-4">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Receipt preview" className="img-fluid rounded border" />
                )}
                {draft.confidence && (
                  <div className="mt-2">
                    <span className={`badge ${draft.confidence === 'high' ? 'bg-success' : draft.confidence === 'medium' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                      <i className="fa fa-robot me-1"></i>AI confidence: {draft.confidence}
                    </span>
                  </div>
                )}
                {draft.notes && (
                  <div className="alert alert-info py-2 mt-2 small mb-0">
                    <i className="fa fa-circle-info me-1"></i>{draft.notes}
                  </div>
                )}
              </div>
              <div className="col-md-8">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">Date</label>
                    <input type="date" className="form-control form-control-sm" value={draft.date} onChange={e => updateDraft('date', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">Amount (AUD)</label>
                    <input type="number" step="0.01" min="0.01" className="form-control form-control-sm" value={draft.amount} onChange={e => updateDraft('amount', e.target.value)} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">Description</label>
                    <input type="text" className="form-control form-control-sm" value={draft.description} onChange={e => updateDraft('description', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">Tax Category</label>
                    <select className="form-select form-select-sm" value={draft.category} onChange={e => updateDraft('category', e.target.value)}>
                      {TAX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {familyMembers.length > 0 && (
                    <div className="col-md-6">
                      <label className="form-label small text-muted mb-1">Owner</label>
                      <select className="form-select form-select-sm" value={draft.owner} onChange={e => updateDraft('owner', e.target.value)}>
                        <option value="">Unassigned</option>
                        {familyMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-12">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="receipt-nondeductible" checked={draft.nonDeductible} onChange={e => updateDraft('nonDeductible', e.target.checked)} />
                      <label className="form-check-label small" htmlFor="receipt-nondeductible">
                        Personal — not tax deductible
                      </label>
                    </div>
                  </div>
                  {scanResult?.spendingCategory && scanResult.spendingCategory !== 'Other' && (
                    <div className="col-12">
                      <span className="text-muted small">
                        <i className="fa fa-tag me-1"></i>Spending category: <strong>{scanResult.spendingCategory}</strong>
                        {scanResult.spendingSubCategory && <> / {scanResult.spendingSubCategory}</>}
                      </span>
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-sm btn-success" disabled={!canSave || saving} onClick={handleSave}>
                    {saving ? <><i className="fa fa-spinner fa-spin me-1"></i>Saving...</> : <><i className="fa fa-check me-1"></i>Save Expense</>}
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={reset} disabled={saving}>
                    <i className="fa fa-times me-1"></i>Discard
                  </button>
                </div>
              </div>
            </div>
          )}
        </PanelBody>
      )}
    </Panel>
  );
}
