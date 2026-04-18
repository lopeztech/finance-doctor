'use client';

import { useState } from 'react';

interface Props {
  count: number;
  /** Category options for the change-category dropdown. Empty array hides the action. */
  categories: string[];
  /** Label shown alongside the change-category select (e.g. "Move to" or "Change category to") */
  changeCategoryLabel?: string;
  onChangeCategory: (category: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClear: () => void;
  /** Optional extra actions rendered before the destructive ones (e.g. Mark non-deductible on Tax page) */
  extraActions?: React.ReactNode;
}

export default function BulkActionsBar({
  count,
  categories,
  changeCategoryLabel = 'Change to',
  onChangeCategory,
  onDelete,
  onClear,
  extraActions,
}: Props) {
  const [busy, setBusy] = useState<'none' | 'category' | 'delete'>('none');

  const handleCategory = async (value: string) => {
    if (!value) return;
    setBusy('category');
    try {
      await onChangeCategory(value);
    } finally {
      setBusy('none');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${count} expense${count === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      await onDelete();
    } finally {
      setBusy('none');
    }
  };

  return (
    <div
      className="alert alert-primary d-flex flex-wrap align-items-center gap-2 mb-3 sticky-top shadow-sm"
      style={{ top: '60px', zIndex: 1020 }}
      role="region"
      aria-label="Bulk actions"
    >
      <span>
        <i className="fa fa-check-square me-2"></i>
        <strong>{count}</strong> selected
      </span>

      {categories.length > 0 && (
        <div className="d-flex align-items-center gap-2">
          <label className="small text-muted mb-0">{changeCategoryLabel}</label>
          <select
            className="form-select form-select-sm"
            value=""
            disabled={busy !== 'none'}
            onChange={e => handleCategory(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">— pick category —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {extraActions}

      <button
        type="button"
        className="btn btn-sm btn-outline-danger"
        onClick={handleDelete}
        disabled={busy !== 'none'}
      >
        {busy === 'delete'
          ? <><i className="fa fa-spinner fa-spin me-1"></i>Deleting…</>
          : <><i className="fa fa-trash me-1"></i>Delete selected</>}
      </button>

      <button
        type="button"
        className="btn btn-sm btn-link ms-sm-auto"
        onClick={onClear}
        disabled={busy !== 'none'}
      >
        Clear selection
      </button>
    </div>
  );
}
