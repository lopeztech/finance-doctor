import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Expense } from './types';
import * as guest from './guest-store';
import { GUEST_DASHBOARD_TIPS, mockTaxAdviceStream, mockInvestmentsAdviceStream, mockExpensesAdviceStream } from './guest-mocks';

type ChatMessage = { role: 'user' | 'model'; text: string };

function assertFunctions() {
  if (!functions) throw new Error('Firebase Functions is not initialised');
  return functions;
}

export async function adviceChatGet<T = ChatMessage>(type: 'tax' | 'investments' | 'expenses' | 'custom-spending-categories'): Promise<T[]> {
  if (guest.isGuest()) return guest.getAdviceChat<T>(type);
  const fn = httpsCallable<{ action: 'get'; type: string }, { history: T[] }>(assertFunctions(), 'adviceChat');
  const res = await fn({ action: 'get', type });
  return res.data.history ?? [];
}

export async function adviceChatPut<T = ChatMessage>(type: 'tax' | 'investments' | 'expenses' | 'custom-spending-categories', history: T[]): Promise<void> {
  if (guest.isGuest()) { guest.setAdviceChat<T>(type, history); return; }
  const fn = httpsCallable<{ action: 'put'; type: string; history: T[] }, { ok: boolean }>(assertFunctions(), 'adviceChat');
  await fn({ action: 'put', type, history });
}

export async function adviceChatDelete(type: 'tax' | 'investments' | 'expenses' | 'custom-spending-categories'): Promise<void> {
  if (guest.isGuest()) { guest.setAdviceChat(type, []); return; }
  const fn = httpsCallable<{ action: 'delete'; type: string }, { ok: boolean }>(assertFunctions(), 'adviceChat');
  await fn({ action: 'delete', type });
}

export interface DashboardTip {
  icon: string;
  tip: string;
  type: 'tax' | 'investment' | 'strategy';
}

export async function fetchDashboardTips(): Promise<DashboardTip[]> {
  if (guest.isGuest()) return GUEST_DASHBOARD_TIPS;
  const fn = httpsCallable<unknown, { tips: DashboardTip[] }>(assertFunctions(), 'dashboardTips');
  const res = await fn({});
  return res.data.tips ?? [];
}

export interface AdviceStreamHandle {
  stream: AsyncIterable<string>;
  final: Promise<string>;
}

export async function streamTaxAdvice(payload: { financialYear?: string; history?: ChatMessage[]; followUp?: string }): Promise<AdviceStreamHandle> {
  if (guest.isGuest()) return mockTaxAdviceStream();
  const fn = httpsCallable<typeof payload, { text: string }, string>(assertFunctions(), 'taxAdvice');
  const result = await fn.stream(payload);
  return { stream: result.stream, final: result.data.then(d => d.text) };
}

export async function streamInvestmentsAdvice(payload: { history?: ChatMessage[]; followUp?: string }): Promise<AdviceStreamHandle> {
  if (guest.isGuest()) return mockInvestmentsAdviceStream();
  const fn = httpsCallable<typeof payload, { text: string }, string>(assertFunctions(), 'investmentsAdvice');
  const result = await fn.stream(payload);
  return { stream: result.stream, final: result.data.then(d => d.text) };
}

export async function streamExpensesAdvice(payload: { history?: ChatMessage[]; followUp?: string }): Promise<AdviceStreamHandle> {
  if (guest.isGuest()) return mockExpensesAdviceStream();
  const fn = httpsCallable<typeof payload, { text: string }, string>(assertFunctions(), 'expensesAdvice');
  const result = await fn.stream(payload);
  return { stream: result.stream, final: result.data.then(d => d.text) };
}

export interface ImportPreviewRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
  financialYear: string;
  duplicate: boolean;
  awaitingCategorisation?: boolean;
}

export interface ImportPreviewResponse {
  preview: ImportPreviewRow[];
  total: number;
  duplicateCount: number;
  deferredCategorisation?: number;
}

export interface ImportSaveResponse {
  saved: Expense[];
  total: number;
  enqueuedForCategorisation?: number;
}

export async function importPreview(csvText: string): Promise<ImportPreviewResponse> {
  if (guest.isGuest()) {
    throw new Error('CSV import is disabled in Guest mode — sign in with Google to import real data.');
  }
  const fn = httpsCallable<{ action: 'preview'; csvText: string }, ImportPreviewResponse>(assertFunctions(), 'expensesImport');
  const res = await fn({ action: 'preview', csvText });
  return res.data;
}

export async function importSave(expenses: (Omit<Expense, 'id'> & { awaitingCategorisation?: boolean })[]): Promise<ImportSaveResponse> {
  if (guest.isGuest()) {
    throw new Error('CSV import is disabled in Guest mode.');
  }
  const fn = httpsCallable<{ action: 'save'; expenses: typeof expenses }, ImportSaveResponse>(assertFunctions(), 'expensesImport');
  const res = await fn({ action: 'save', expenses });
  return res.data;
}

export interface MigrateFixResult {
  total: number;
  fixed: number;
  addedFY: number;
  setOwner: number;
  needsCategorisation: number;
}

export async function migrateFix(): Promise<MigrateFixResult> {
  if (guest.isGuest()) return { total: 30, fixed: 0, addedFY: 0, setOwner: 0, needsCategorisation: 0 };
  const fn = httpsCallable<{ action: 'fix' }, MigrateFixResult>(assertFunctions(), 'expensesMigrate');
  const res = await fn({ action: 'fix' });
  return res.data;
}

export interface MigrateCategoriseResult {
  categorised: number;
  ruleApplied: number;
  aiCategorised?: number;
  remaining: number;
  batchProcessed?: number;
}

export async function migrateCategorise(batchSize = 50): Promise<MigrateCategoriseResult> {
  if (guest.isGuest()) return { categorised: 0, ruleApplied: 0, remaining: 0 };
  const fn = httpsCallable<{ action: 'categorise'; batchSize?: number }, MigrateCategoriseResult>(assertFunctions(), 'expensesMigrate');
  const res = await fn({ action: 'categorise', batchSize });
  return res.data;
}

export type CashflowDestination = 'family-member' | 'income-source' | 'property' | 'skip';
export type CashflowAction = 'create' | 'update' | 'skip';

export interface CashflowPreviewRow {
  rowIndex: number;
  rawType: string;
  destination: CashflowDestination;
  action: CashflowAction;
  label: string;
  amount: number;
  cadence?: 'weekly' | 'fortnightly' | 'monthly' | 'annual';
  owner?: string;
  error?: string;
  // Payloads are opaque to the client; we round-trip them back to save.
  familyMember?: Record<string, unknown>;
  familyMemberId?: string;
  incomeSource?: Record<string, unknown>;
  investmentId?: string;
  investmentRentalMonthly?: number;
}

export interface CashflowImportPreviewResponse {
  preview: CashflowPreviewRow[];
  total: number;
  skipped: number;
  creates: number;
  updates: number;
}

export interface CashflowImportSaveResponse {
  familyMembersWritten: number;
  incomeSourcesWritten: number;
  propertiesUpdated: number;
}

export async function cashflowImportPreview(csvText: string): Promise<CashflowImportPreviewResponse> {
  if (guest.isGuest()) throw new Error('Cashflow CSV import is disabled in Guest mode.');
  const fn = httpsCallable<{ action: 'preview'; csvText: string }, CashflowImportPreviewResponse>(assertFunctions(), 'cashflowImport');
  const res = await fn({ action: 'preview', csvText });
  return res.data;
}

export async function cashflowImportSave(rows: CashflowPreviewRow[]): Promise<CashflowImportSaveResponse> {
  if (guest.isGuest()) throw new Error('Cashflow CSV import is disabled in Guest mode.');
  const fn = httpsCallable<{ action: 'save'; rows: CashflowPreviewRow[] }, CashflowImportSaveResponse>(assertFunctions(), 'cashflowImport');
  const res = await fn({ action: 'save', rows });
  return res.data;
}

export async function reanalyseExpenses(payload: { financialYear?: string; type?: 'tax' | 'spending' | 'sub-category' }): Promise<{ updated: number; total: number }> {
  if (guest.isGuest()) return { updated: 0, total: 0 };
  const fn = httpsCallable<typeof payload, { updated: number; total: number }>(assertFunctions(), 'expensesReanalyse');
  const res = await fn(payload);
  return res.data;
}
