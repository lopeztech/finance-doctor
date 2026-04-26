import {
  describeBudget,
  describeScope,
  thresholdLabel,
} from '@/lib/budgets-calc';
import {
  DEFAULT_SPENDING_CATEGORIES,
  SPENDING_COLORS,
  SPENDING_ICONS,
  spendingColor,
  spendingIcon,
} from '@/lib/spending-categories';
import {
  LIABILITY_KIND_ICON,
  LIABILITY_KIND_LABEL,
} from '@/lib/networth-types';
import type { Budget } from '@/lib/budgets-types';

const base: Budget = {
  id: 'b',
  scope: 'spending-category',
  category: 'Groceries',
  amount: 800,
  period: 'monthly',
  startMonth: '2026-01',
  rolloverUnused: false,
  alertThresholds: [0.8, 1.0, 1.2],
};

describe('describeBudget', () => {
  it('handles overall scope', () => {
    expect(describeBudget({ ...base, scope: 'overall', category: undefined })).toBe('Overall monthly spending');
  });

  it('returns the category name for spending-category scope', () => {
    expect(describeBudget(base)).toBe('Groceries');
  });

  it('chains category and sub-category for sub scope', () => {
    expect(describeBudget({ ...base, scope: 'spending-sub-category', subCategory: 'Coffee' })).toBe('Groceries → Coffee');
  });

  it('falls back to a sensible label when category is missing', () => {
    expect(describeBudget({ ...base, category: undefined })).toBe('Uncategorised');
  });
});

describe('describeScope + thresholdLabel', () => {
  it('describeScope maps every scope', () => {
    expect(describeScope('overall')).toBe('Overall');
    expect(describeScope('spending-category')).toBe('Category');
    expect(describeScope('spending-sub-category')).toBe('Sub-category');
  });

  it('thresholdLabel renders fractions as integer percent', () => {
    expect(thresholdLabel(0.8)).toBe('80%');
    expect(thresholdLabel(1)).toBe('100%');
    expect(thresholdLabel(1.2)).toBe('120%');
  });
});

describe('spending-categories helpers', () => {
  it('exposes 21 categories with paired icon + colour', () => {
    expect(DEFAULT_SPENDING_CATEGORIES).toHaveLength(21);
    for (const c of DEFAULT_SPENDING_CATEGORIES) {
      expect(SPENDING_ICONS[c]).toMatch(/^fa-/);
      expect(SPENDING_COLORS[c]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('spendingIcon falls back for unknown categories', () => {
    expect(spendingIcon('Groceries')).toBe('fa-cart-shopping');
    expect(spendingIcon('totally-unknown')).toBe('fa-ellipsis');
    expect(spendingIcon(undefined)).toBe('fa-ellipsis');
    expect(spendingIcon(null)).toBe('fa-ellipsis');
  });

  it('spendingColor falls back for unknown categories', () => {
    expect(spendingColor('Groceries')).toBe('#20c997');
    expect(spendingColor('totally-unknown')).toBe('#6c757d');
    expect(spendingColor(undefined)).toBe('#6c757d');
  });
});

describe('liability label/icon maps', () => {
  it('covers every liability kind', () => {
    const kinds: (keyof typeof LIABILITY_KIND_LABEL)[] = [
      'mortgage', 'personal-loan', 'car-loan', 'student-loan', 'credit-card', 'other',
    ];
    for (const k of kinds) {
      expect(LIABILITY_KIND_LABEL[k]).toBeTruthy();
      expect(LIABILITY_KIND_ICON[k]).toMatch(/^fa-/);
    }
  });
});
