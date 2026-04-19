'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { adviceChatGet } from '@/lib/functions-client';
import { listExpenses } from '@/lib/expenses-repo';
import { getCategorySettings, setExcludedCategories, type CategorySettings } from '@/lib/category-settings-repo';

const DEFAULT_SPENDING_CATEGORIES = [
  'Bakery', 'Cafe', 'Car', 'Dining & Takeaway', 'Education', 'Entertainment',
  'Financial & Banking', 'Gifts & Donations', 'Groceries', 'Healthcare',
  'Home & Garden', 'Insurance', 'Kids Entertainment', 'Personal Care',
  'Personal Project', 'Shopping', 'Subscriptions', 'Transport',
  'Travel & Holidays', 'Utilities & Bills', 'Other',
];

export default function ExpensesExclusionSettings() {
  const [settings, setSettings] = useState<CategorySettings>({ types: {}, excluded: [] });
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCategorySettings(),
      adviceChatGet<string>('custom-spending-categories').catch(() => [] as string[]),
      listExpenses('all').catch(() => []),
    ]).then(([s, custom, expenses]) => {
      setSettings(s);
      const observed = expenses.map(e => e.spendingCategory).filter(Boolean) as string[];
      setAllCategories([...new Set([...DEFAULT_SPENDING_CATEGORIES, ...custom, ...observed])].sort((a, b) => a.localeCompare(b)));
      setLoading(false);
    });
  }, []);

  const toggle = async (category: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...settings.excluded, category])]
      : settings.excluded.filter(c => c !== category);
    setSettings(prev => ({ ...prev, excluded: next }));
    setSaving(true);
    try {
      const saved = await setExcludedCategories(next);
      setSettings(saved);
    } catch {
      setSettings(prev => ({ ...prev, excluded: settings.excluded }));
    }
    setSaving(false);
  };

  return (
    <Panel>
      <PanelHeader noButton>
        <i className="fa fa-eye-slash me-2"></i>Exclude from Expenses Analysis
      </PanelHeader>
      <PanelBody>
        <p className="text-muted small mb-3">
          Ticked categories are hidden from the Expenses view, charts, and AI Doctor — useful for tax-deductible items
          that don&apos;t reflect day-to-day cashflow (e.g. investment property interest). Excluded categories remain
          visible in Tax.
        </p>
        {loading ? (
          <div className="text-center py-3"><i className="fa fa-spinner fa-spin"></i></div>
        ) : (
          <div className="row g-2">
            {allCategories.map(cat => {
              const checked = settings.excluded.includes(cat);
              return (
                <div key={cat} className="col-md-6 col-lg-4">
                  <label className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={checked}
                      disabled={saving}
                      onChange={ev => toggle(cat, ev.target.checked)}
                    />
                    <span className={`form-check-label ${checked ? 'fw-bold' : ''}`}>{cat}</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
