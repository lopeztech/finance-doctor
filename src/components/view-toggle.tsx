'use client';

import { useEffect, useState } from 'react';

export type ViewMode = 'doctor' | 'summary' | 'detail';

const ALL_MODES: ViewMode[] = ['doctor', 'summary', 'detail'];

export function useViewMode(storageKey: string, initial: ViewMode = 'summary'): [ViewMode, (m: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(initial);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored && (ALL_MODES as string[]).includes(stored)) setModeState(stored as ViewMode);
    } catch {}
  }, [storageKey]);
  const setMode = (next: ViewMode) => {
    setModeState(next);
    try { window.localStorage.setItem(storageKey, next); } catch {}
  };
  return [mode, setMode];
}

interface ViewToggleProps {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
  className?: string;
  showDoctor?: boolean;
}

export function ViewToggle({ value, onChange, className = '', showDoctor = false }: ViewToggleProps) {
  return (
    <div className={`btn-group btn-group-sm ${className}`} role="group" aria-label="View mode">
      {showDoctor && (
        <button type="button" className={`btn ${value === 'doctor' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onChange('doctor')}>
          <i className="fa fa-stethoscope me-1"></i>Doctor
        </button>
      )}
      <button type="button" className={`btn ${value === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onChange('summary')}>
        <i className="fa fa-chart-pie me-1"></i>Summary
      </button>
      <button type="button" className={`btn ${value === 'detail' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onChange('detail')}>
        <i className="fa fa-list me-1"></i>Detail
      </button>
    </div>
  );
}
