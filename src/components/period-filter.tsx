'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Period,
  type PresetId,
  presetToRange,
  presetLabel,
  fyToRange,
  currentFinancialYear,
  shortFyLabel,
} from '@/lib/period';

const GENERAL_PRESETS: PresetId[] = [
  'this-month',
  'last-3m',
  'last-6m',
  'ytd',
  'this-fy',
  'last-fy',
  'all',
];

interface PeriodFilterProps {
  /** Called whenever the resolved period changes (mount, preset click, custom Apply). */
  onChange: (p: Period) => void;
  defaultPreset?: PresetId;
  storageKey?: string;
  className?: string;
}

type StoredGeneral =
  | { presetId: Exclude<PresetId, 'custom'> }
  | { presetId: 'custom'; from: string; to: string };

export function PeriodFilter({
  onChange,
  defaultPreset = 'last-6m',
  storageKey,
  className = '',
}: PeriodFilterProps) {
  const [presetId, setPresetId] = useState<PresetId>(defaultPreset);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Hydrate from localStorage (or fall back to default) once on mount.
  useEffect(() => {
    let resolvedPeriod: Period = presetToRange(defaultPreset);
    let resolvedPreset: PresetId = defaultPreset;
    let from = '';
    let to = '';
    if (storageKey) {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredGeneral;
          if (parsed.presetId === 'custom' && parsed.from && parsed.to) {
            resolvedPreset = 'custom';
            resolvedPeriod = { fromYmd: parsed.from, toYmd: parsed.to };
            from = parsed.from;
            to = parsed.to;
          } else if (
            parsed.presetId &&
            (GENERAL_PRESETS as string[]).includes(parsed.presetId)
          ) {
            resolvedPreset = parsed.presetId;
            resolvedPeriod = presetToRange(resolvedPreset);
          }
        }
      } catch {}
    }
    setPresetId(resolvedPreset);
    setCustomFrom(from);
    setCustomTo(to);
    onChangeRef.current(resolvedPeriod);
  }, [defaultPreset, storageKey]);

  const persist = (data: StoredGeneral) => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {}
  };

  const selectPreset = (id: PresetId) => {
    setPresetId(id);
    if (id === 'custom') {
      // Wait for the user to pick dates and click Apply before firing onChange.
      return;
    }
    onChange(presetToRange(id));
    persist({ presetId: id });
  };

  const applyCustom = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    onChange({ fromYmd: customFrom, toYmd: customTo });
    persist({ presetId: 'custom', from: customFrom, to: customTo });
  };

  const label = useMemo(() => {
    if (presetId === 'custom') {
      if (customFrom && customTo) return `${customFrom} → ${customTo}`;
      return 'Custom range';
    }
    return presetLabel(presetId);
  }, [presetId, customFrom, customTo]);

  return (
    <div className={`dropdown d-inline-block ${className}`}>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary dropdown-toggle"
        data-bs-toggle="dropdown"
        data-bs-auto-close={presetId === 'custom' ? 'outside' : 'true'}
        aria-expanded="false"
      >
        <i className="fa fa-calendar me-1"></i>
        {label}
      </button>
      <ul className="dropdown-menu" style={{ minWidth: '220px' }}>
        {GENERAL_PRESETS.map(id => (
          <li key={id}>
            <button
              type="button"
              className={`dropdown-item ${presetId === id ? 'active' : ''}`}
              onClick={() => selectPreset(id)}
            >
              {presetLabel(id)}
            </button>
          </li>
        ))}
        <li>
          <hr className="dropdown-divider" />
        </li>
        <li>
          <button
            type="button"
            className={`dropdown-item ${presetId === 'custom' ? 'active' : ''}`}
            onClick={() => selectPreset('custom')}
          >
            Custom range…
          </button>
        </li>
        {presetId === 'custom' && (
          <li>
            <div className="px-3 py-2" style={{ minWidth: '240px' }}>
              <label className="form-label small mb-1">From</label>
              <input
                type="date"
                className="form-control form-control-sm mb-2"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <label className="form-label small mb-1">To</label>
              <input
                type="date"
                className="form-control form-control-sm mb-2"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary w-100"
                disabled={!customFrom || !customTo || customFrom > customTo}
                onClick={applyCustom}
              >
                Apply
              </button>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}

interface FinancialYearFilterProps {
  onChange: (p: Period) => void;
  /** FY strings ("YYYY-YYYY") found in the page's data — current and last FY are always included. */
  availableFys: string[];
  /** 'current' / 'last' / explicit FY string ("YYYY-YYYY"). Overridden by localStorage if storageKey hits. */
  defaultFy?: 'current' | 'last' | string;
  storageKey?: string;
  className?: string;
}

function fyDisplayLabel(fy: string, currentFy: string, lastFy: string): string {
  if (fy === currentFy) return `This FY (${shortFyLabel(fy)})`;
  if (fy === lastFy) return `Last FY (${shortFyLabel(fy)})`;
  return `FY ${shortFyLabel(fy)}`;
}

export function FinancialYearFilter({
  onChange,
  availableFys,
  defaultFy = 'current',
  storageKey,
  className = '',
}: FinancialYearFilterProps) {
  const today = useMemo(() => new Date(), []);
  const currentFy = useMemo(() => currentFinancialYear(today), [today]);
  const lastFy = useMemo(() => {
    const startYear = parseInt(currentFy.split('-')[0], 10);
    return `${startYear - 1}-${startYear}`;
  }, [currentFy]);

  // Always include current + last FY even if data has none yet, then merge in
  // any older FYs from the page's data, sorted newest first.
  const fys = useMemo(() => {
    const set = new Set<string>([currentFy, lastFy, ...availableFys]);
    return Array.from(set)
      .filter(fy => /^\d{4}-\d{4}$/.test(fy))
      .sort((a, b) => b.localeCompare(a));
  }, [currentFy, lastFy, availableFys]);

  const initialFy = useMemo(() => {
    if (defaultFy === 'last') return lastFy;
    if (defaultFy && defaultFy !== 'current' && /^\d{4}-\d{4}$/.test(defaultFy)) return defaultFy;
    return currentFy;
  }, [defaultFy, currentFy, lastFy]);
  const [selectedFy, setSelectedFy] = useState<string>(initialFy);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Hydrate from localStorage on mount; fall back to default if stored value is unknown.
  useEffect(() => {
    let chosen = initialFy;
    if (storageKey) {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored && /^\d{4}-\d{4}$/.test(stored)) chosen = stored;
      } catch {}
    }
    setSelectedFy(chosen);
    onChangeRef.current(fyToRange(chosen));
  }, [initialFy, storageKey]);

  const select = (fy: string) => {
    setSelectedFy(fy);
    onChange(fyToRange(fy));
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, fy);
      } catch {}
    }
  };

  return (
    <div className={`dropdown d-inline-block ${className}`}>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary dropdown-toggle"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <i className="fa fa-calendar me-1"></i>
        {fyDisplayLabel(selectedFy, currentFy, lastFy)}
      </button>
      <ul className="dropdown-menu" style={{ minWidth: '180px' }}>
        {fys.map(fy => (
          <li key={fy}>
            <button
              type="button"
              className={`dropdown-item ${selectedFy === fy ? 'active' : ''}`}
              onClick={() => select(fy)}
            >
              {fyDisplayLabel(fy, currentFy, lastFy)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
