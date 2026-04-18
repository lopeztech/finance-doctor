'use client';

import { useState } from 'react';
import type { Expense } from '@/lib/types';

type Frequency = 'monthly' | 'quarterly' | 'yearly';

interface Props {
  expense: Expense;
  onClose: () => void;
  onConfirm: (occurrences: Omit<Expense, 'id'>[]) => Promise<void>;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function getFinancialYear(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export default function RecurringModal({ expense, onClose, onConfirm }: Props) {
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [count, setCount] = useState(11);
  const [busy, setBusy] = useState(false);

  const monthsStep = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;

  const preview = Array.from({ length: count }, (_, i) => {
    const date = addMonths(expense.date, monthsStep * (i + 1));
    return { date, financialYear: getFinancialYear(date) };
  });

  const handleConfirm = async () => {
    setBusy(true);
    const groupId = expense.recurrenceGroupId || expense.id;
    const occurrences: Omit<Expense, 'id'>[] = preview.map(p => {
      const { id: _id, ...rest } = expense;
      return {
        ...rest,
        date: p.date,
        financialYear: p.financialYear,
        recurrenceGroupId: groupId,
      };
    });
    try {
      await onConfirm(occurrences);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title"><i className="fa fa-repeat me-2"></i>Make Recurring</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="bg-light rounded p-2 mb-3 small">
              <div><strong>{expense.description}</strong></div>
              <div className="text-muted">${expense.amount.toFixed(2)} · {expense.category}{expense.owner ? ` · ${expense.owner}` : ''}</div>
            </div>
            <div className="mb-3">
              <label className="form-label">Frequency</label>
              <select className="form-select" value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Number of future occurrences</label>
              <input
                type="number"
                className="form-control"
                min={1}
                max={60}
                value={count}
                onChange={e => setCount(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              />
              <div className="form-text">Creates {count} new expense{count === 1 ? '' : 's'} from the source date forward.</div>
            </div>
            <div className="small text-muted">
              Next dates: {preview.slice(0, 3).map(p => new Date(p.date).toLocaleDateString('en-AU')).join(', ')}
              {preview.length > 3 && ` … ${new Date(preview[preview.length - 1].date).toLocaleDateString('en-AU')}`}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={busy}>
              {busy ? <><i className="fa fa-spinner fa-spin me-1"></i>Creating…</> : <>Create {count} recurring</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
