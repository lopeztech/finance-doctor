import {
  activeEofyFinancialYear,
  checklistCompletion,
  daysUntilEofyEnd,
  daysUntilLodgement,
  evaluateEofyChecklist,
  isEofySeason,
  SUPER_CONCESSIONAL_CAP,
} from '@/lib/eofy';
import type { Expense } from '@/lib/types';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e' + Math.random(),
  date: '2026-04-15',
  description: 'X',
  amount: 0,
  category: 'Other Deductions',
  financialYear: '2025-2026',
  ...overrides,
});

describe('isEofySeason', () => {
  it('is true between May and July inclusive', () => {
    expect(isEofySeason(new Date(2026, 4, 1))).toBe(true);   // 1 May
    expect(isEofySeason(new Date(2026, 5, 30))).toBe(true);  // 30 June
    expect(isEofySeason(new Date(2026, 6, 31))).toBe(true);  // 31 July
  });

  it('is false outside that window', () => {
    expect(isEofySeason(new Date(2026, 3, 30))).toBe(false); // 30 April
    expect(isEofySeason(new Date(2026, 7, 1))).toBe(false);  // 1 August
  });
});

describe('daysUntilEofyEnd / daysUntilLodgement', () => {
  it('counts down to 30 June for the FY', () => {
    const days = daysUntilEofyEnd('2025-2026', new Date(2026, 5, 28, 12));
    expect(days).toBeLessThanOrEqual(3);
    expect(days).toBeGreaterThanOrEqual(2);
  });

  it('zero when the deadline has passed', () => {
    expect(daysUntilEofyEnd('2025-2026', new Date(2027, 0, 1))).toBe(0);
  });

  it('counts down to 31 October for lodgement of the FY', () => {
    expect(daysUntilLodgement('2025-2026', new Date(2026, 9, 30, 12))).toBe(2);
    expect(daysUntilLodgement('2025-2026', new Date(2026, 10, 1))).toBe(0);
  });
});

describe('activeEofyFinancialYear', () => {
  it('between Jan and June, points at the FY ending 30 June', () => {
    expect(activeEofyFinancialYear(new Date(2026, 3, 26))).toBe('2025-2026');
  });

  it('from July onwards, points at the just-closed FY', () => {
    expect(activeEofyFinancialYear(new Date(2026, 7, 1))).toBe('2025-2026');
    expect(activeEofyFinancialYear(new Date(2026, 11, 31))).toBe('2025-2026');
  });
});

describe('evaluateEofyChecklist', () => {
  const fy = '2025-2026';

  it('marks "categorise all" done when no pending/failed in the FY', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [
        expense({ amount: 100, categorisationStatus: 'done' }),
      ],
    });
    expect(items.find(i => i.id === 'categorise-all')?.done).toBe(true);
  });

  it('flags pending categorisation as not-done with a count', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [
        expense({ amount: 100, categorisationStatus: 'pending' }),
        expense({ amount: 50, categorisationStatus: 'failed' }),
        expense({ amount: 50, categorisationStatus: 'done' }),
      ],
    });
    const item = items.find(i => i.id === 'categorise-all');
    expect(item?.done).toBe(false);
    expect(item?.detail).toMatch(/2 expense/);
  });

  it('flags receipts-needed when there are large deductions', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [
        expense({ amount: 400 }),
        expense({ amount: 100 }),
      ],
    });
    expect(items.find(i => i.id === 'large-deduction-receipts')?.done).toBe(false);
  });

  it('only counts expenses for the supplied FY', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [
        expense({ amount: 999, financialYear: '2024-2025', categorisationStatus: 'pending' }),
        expense({ amount: 100, financialYear: fy, categorisationStatus: 'done' }),
      ],
    });
    expect(items.find(i => i.id === 'categorise-all')?.done).toBe(true);
  });

  it('flags WFH hours as missing for unlogged claimants', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [],
      wfhClaimantIds: ['m1', 'm2'],
      wfhHoursLoggedFor: ['m1'],
    });
    expect(items.find(i => i.id === 'wfh-hours-logged')?.done).toBe(false);
  });

  it('flags super salary-sacrifice over the concessional cap', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [],
      superSalarySacrificeTotal: SUPER_CONCESSIONAL_CAP + 5000,
    });
    expect(items.find(i => i.id === 'super-cap')?.done).toBe(false);
  });

  it('marks insurance + donations done when at least one of each exists', () => {
    const items = evaluateEofyChecklist({
      financialYear: fy,
      expenses: [
        expense({ category: 'Donations', amount: 50 }),
        expense({ spendingCategory: 'Insurance', amount: 100 }),
      ],
    });
    expect(items.find(i => i.id === 'insurance-donations')?.done).toBe(true);
  });
});

describe('checklistCompletion', () => {
  it('reports done/total/pct', () => {
    const result = checklistCompletion(evaluateEofyChecklist({
      financialYear: '2025-2026',
      expenses: [],
    }));
    expect(result.total).toBeGreaterThan(0);
    expect(result.pct).toBeGreaterThanOrEqual(0);
    expect(result.pct).toBeLessThanOrEqual(100);
  });
});
