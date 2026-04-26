'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { usePreferences } from '@/lib/use-preferences';
import {
  DATE_FORMAT_OPTIONS,
  HOMEPAGE_OPTIONS,
  NUMBER_LOCALE_OPTIONS,
  type CurrencyDisplay,
  type DateFormat,
  type Density,
  type Homepage,
  type NumberLocale,
} from '@/lib/user-preferences-types';
import { formatCurrency, formatDate } from '@/lib/format';
import { currentFinancialYear } from '@/lib/tax-deadline';

type Tab = 'display' | 'defaults' | 'privacy';

export default function PreferencesPanel() {
  const { prefs, ready, update } = usePreferences();
  const [tab, setTab] = useState<Tab>('display');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = async (patch: Parameters<typeof update>[0]) => {
    setSaving(true);
    try {
      await update(patch);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  // Build a list of FY options around the current one (current ± 3 years).
  const fyOptions = useMemo(() => {
    const fy = currentFinancialYear();
    const startYear = Number(fy.split('-')[0]);
    const list: string[] = [];
    for (let y = startYear - 3; y <= startYear + 1; y++) list.push(`${y}-${y + 1}`);
    return list.reverse();
  }, []);

  return (
    <Panel className="mt-4">
      <PanelHeader noButton>
        <i className="fa fa-sliders me-2"></i>Preferences
      </PanelHeader>
      <PanelBody>
        {!ready ? (
          <div className="text-muted small"><i className="fa fa-spinner fa-spin me-1"></i>Loading…</div>
        ) : (
          <>
            <ul className="nav nav-tabs mb-3">
              {(['display', 'defaults', 'privacy'] as Tab[]).map(t => (
                <li className="nav-item" key={t}>
                  <button
                    type="button"
                    className={`nav-link ${tab === t ? 'active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'display' && <><i className="fa fa-eye me-1"></i>Display</>}
                    {t === 'defaults' && <><i className="fa fa-flag me-1"></i>Defaults</>}
                    {t === 'privacy' && <><i className="fa fa-shield-halved me-1"></i>Privacy</>}
                  </button>
                </li>
              ))}
              <li className="nav-item ms-auto d-flex align-items-center pe-2">
                {saving && <small className="text-muted"><i className="fa fa-spinner fa-spin me-1"></i>Saving</small>}
                {!saving && savedAt && <small className="text-success"><i className="fa fa-check me-1"></i>Saved</small>}
              </li>
            </ul>

            {tab === 'display' && (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted">Date format</label>
                  <select
                    className="form-select form-select-sm"
                    value={prefs.display.dateFormat}
                    onChange={e => persist({ display: { ...prefs.display, dateFormat: e.target.value as DateFormat } })}
                  >
                    {DATE_FORMAT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label} — {opt.example}</option>
                    ))}
                  </select>
                  <small className="text-muted">Preview: {formatDate(new Date(), prefs)}</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">Number locale</label>
                  <select
                    className="form-select form-select-sm"
                    value={prefs.display.numberLocale}
                    onChange={e => persist({ display: { ...prefs.display, numberLocale: e.target.value as NumberLocale } })}
                  >
                    {NUMBER_LOCALE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">Currency display</label>
                  <select
                    className="form-select form-select-sm"
                    value={prefs.display.currencyDisplay}
                    onChange={e => persist({ display: { ...prefs.display, currencyDisplay: e.target.value as CurrencyDisplay } })}
                  >
                    <option value="symbol">Symbol — $1,234</option>
                    <option value="code">Code — AUD 1,234</option>
                  </select>
                  <small className="text-muted">Preview: {formatCurrency(1234.56, prefs, { decimals: 2 })}</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">Density</label>
                  <select
                    className="form-select form-select-sm"
                    value={prefs.display.density}
                    onChange={e => persist({ display: { ...prefs.display, density: e.target.value as Density } })}
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                  <small className="text-muted">Compact reduces row spacing in tables.</small>
                </div>
              </div>
            )}

            {tab === 'defaults' && (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted">Homepage</label>
                  <select
                    className="form-select form-select-sm"
                    value={prefs.defaults.homepage}
                    onChange={e => persist({ defaults: { ...prefs.defaults, homepage: e.target.value as Homepage } })}
                  >
                    {HOMEPAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <small className="text-muted">Where you land after sign-in.</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">Default financial year</label>
                  <select
                    className="form-select form-select-sm"
                    value={prefs.defaults.defaultFinancialYear}
                    onChange={e => persist({ defaults: { ...prefs.defaults, defaultFinancialYear: e.target.value } })}
                  >
                    <option value="current">Current FY ({currentFinancialYear()})</option>
                    {fyOptions.map(fy => (
                      <option key={fy} value={fy}>FY {fy}</option>
                    ))}
                  </select>
                  <small className="text-muted">Used by the Dashboard and Tax filters on first load.</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">Default member (expense / investment owner)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Alex"
                    value={prefs.defaults.defaultMember || ''}
                    onChange={e => persist({ defaults: { ...prefs.defaults, defaultMember: e.target.value || undefined } })}
                  />
                  <small className="text-muted">Pre-fills the Owner field on new entries. Leave blank for none.</small>
                </div>
              </div>
            )}

            {tab === 'privacy' && (
              <div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="ai-advice-enabled"
                    checked={prefs.privacy.aiAdviceEnabled}
                    onChange={e => persist({ privacy: { ...prefs.privacy, aiAdviceEnabled: e.target.checked } })}
                  />
                  <label className="form-check-label" htmlFor="ai-advice-enabled">
                    <strong>AI features enabled</strong>
                  </label>
                  <div className="text-muted small">
                    Hard kill switch. When off, Dr Finance, dashboard tips, AI categorisation,
                    and receipt scanning never call Gemini. The panels show a disabled-state
                    message instead.
                  </div>
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="ai-context-opt-out"
                    checked={prefs.privacy.aiContextOptOut}
                    disabled={!prefs.privacy.aiAdviceEnabled}
                    onChange={e => persist({ privacy: { ...prefs.privacy, aiContextOptOut: e.target.checked } })}
                  />
                  <label className="form-check-label" htmlFor="ai-context-opt-out">
                    <strong>Strip expense descriptions from AI prompts</strong>
                  </label>
                  <div className="text-muted small">
                    Sends only category and amount to Gemini — useful if descriptions could
                    contain sensitive text. Some advice quality may be reduced.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
