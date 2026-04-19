'use client';

import { useMemo, useState } from 'react';

export interface FilterGroup<T extends string = string> {
  id: string;
  icon?: string;
  label: string;
  allLabel?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; sublabel?: string }[];
  collapseAfter?: number;
}

interface PageFiltersProps {
  groups: FilterGroup[];
  className?: string;
}

export function PageFilters({ groups, className = '' }: PageFiltersProps) {
  const hasAnyActive = groups.some(g => g.value !== (g.options[0]?.value ?? ''));

  if (groups.length === 0) return null;

  return (
    <div className={`page-filters ${className}`}>
      <div className="d-flex flex-wrap align-items-start gap-3">
        {groups.map(g => (
          <FilterChipGroup key={g.id} group={g} />
        ))}
        {hasAnyActive && (
          <button
            type="button"
            className="btn btn-sm btn-link text-muted text-decoration-none align-self-center"
            onClick={() => groups.forEach(g => g.onChange(g.options[0]?.value ?? ''))}
            title="Reset all filters"
          >
            <i className="fa fa-rotate-left me-1"></i>Reset
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChipGroup({ group }: { group: FilterGroup }) {
  const [expanded, setExpanded] = useState(false);
  const collapseAfter = group.collapseAfter ?? 8;
  const { visibleOptions, hiddenCount } = useMemo(() => {
    if (expanded || group.options.length <= collapseAfter) {
      return { visibleOptions: group.options, hiddenCount: 0 };
    }
    // Always show the first option (the "All" option) + collapseAfter more, keep active value visible
    const head = group.options.slice(0, collapseAfter);
    const activeIdx = group.options.findIndex(o => o.value === group.value);
    if (activeIdx >= 0 && activeIdx < collapseAfter) {
      return { visibleOptions: head, hiddenCount: group.options.length - collapseAfter };
    }
    // Active option is past the cutoff — include it
    return {
      visibleOptions: [...head.slice(0, collapseAfter - 1), group.options[activeIdx]],
      hiddenCount: group.options.length - collapseAfter,
    };
  }, [group.options, group.value, expanded, collapseAfter]);

  return (
    <div className="d-flex flex-column">
      <div className="text-muted text-uppercase small mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
        {group.icon && <i className={`fa ${group.icon} me-1`}></i>}
        {group.label}
      </div>
      <div className="d-flex flex-wrap gap-1" role="group" aria-label={group.label}>
        {visibleOptions.map(opt => {
          const active = opt.value === group.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'} rounded-pill px-3`}
              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              onClick={() => group.onChange(opt.value)}
              aria-pressed={active}
            >
              {opt.label}
              {opt.sublabel && <span className="ms-1 text-muted small">{opt.sublabel}</span>}
            </button>
          );
        })}
        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            className="btn btn-sm btn-link text-muted text-decoration-none px-2"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setExpanded(true)}
          >
            +{hiddenCount} more
          </button>
        )}
        {expanded && group.options.length > collapseAfter && (
          <button
            type="button"
            className="btn btn-sm btn-link text-muted text-decoration-none px-2"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setExpanded(false)}
          >
            Less
          </button>
        )}
      </div>
    </div>
  );
}
