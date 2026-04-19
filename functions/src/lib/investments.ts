import type { Investment } from './types';

// Convert a Firestore investment doc into the canonical shape. Older property
// docs carry `rentalIncomeAnnual`; we translate that to `rentalIncomeMonthly`
// on read so the rest of the codebase only deals with the monthly figure.
export function normaliseInvestment(raw: Record<string, unknown>): Investment {
  const { rentalIncomeAnnual, ...rest } = raw as { rentalIncomeAnnual?: number } & Partial<Investment> & Record<string, unknown>;
  const inv = rest as Investment;
  if (inv.rentalIncomeMonthly == null && typeof rentalIncomeAnnual === 'number') {
    inv.rentalIncomeMonthly = rentalIncomeAnnual / 12;
  }
  return inv;
}
