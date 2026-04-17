import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Expense } from './types';

type ChatMessage = { role: 'user' | 'model'; text: string };

function assertFunctions() {
  if (!functions) throw new Error('Firebase Functions is not initialised');
  return functions;
}

export async function adviceChatGet<T = ChatMessage>(type: 'tax' | 'investments' | 'custom-spending-categories'): Promise<T[]> {
  const fn = httpsCallable<{ action: 'get'; type: string }, { history: T[] }>(assertFunctions(), 'adviceChat');
  const res = await fn({ action: 'get', type });
  return res.data.history ?? [];
}

export async function adviceChatPut<T = ChatMessage>(type: 'tax' | 'investments' | 'custom-spending-categories', history: T[]): Promise<void> {
  const fn = httpsCallable<{ action: 'put'; type: string; history: T[] }, { ok: boolean }>(assertFunctions(), 'adviceChat');
  await fn({ action: 'put', type, history });
}

export async function adviceChatDelete(type: 'tax' | 'investments' | 'custom-spending-categories'): Promise<void> {
  const fn = httpsCallable<{ action: 'delete'; type: string }, { ok: boolean }>(assertFunctions(), 'adviceChat');
  await fn({ action: 'delete', type });
}

export interface DashboardTip {
  icon: string;
  tip: string;
  type: 'tax' | 'investment' | 'strategy';
}

export async function fetchDashboardTips(): Promise<DashboardTip[]> {
  const fn = httpsCallable<unknown, { tips: DashboardTip[] }>(assertFunctions(), 'dashboardTips');
  const res = await fn({});
  return res.data.tips ?? [];
}

export interface AdviceStreamHandle {
  stream: AsyncIterable<string>;
  final: Promise<string>;
}

export async function streamTaxAdvice(payload: { financialYear?: string; history?: ChatMessage[]; followUp?: string }): Promise<AdviceStreamHandle> {
  const fn = httpsCallable<typeof payload, { text: string }, string>(assertFunctions(), 'taxAdvice');
  const result = await fn.stream(payload);
  return { stream: result.stream, final: result.data.then(d => d.text) };
}

export async function streamInvestmentsAdvice(payload: { history?: ChatMessage[]; followUp?: string }): Promise<AdviceStreamHandle> {
  const fn = httpsCallable<typeof payload, { text: string }, string>(assertFunctions(), 'investmentsAdvice');
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
}

export async function importPreview(csvText: string): Promise<{ preview: ImportPreviewRow[]; total: number; duplicateCount: number }> {
  const fn = httpsCallable<{ action: 'preview'; csvText: string }, { preview: ImportPreviewRow[]; total: number; duplicateCount: number }>(assertFunctions(), 'expensesImport');
  const res = await fn({ action: 'preview', csvText });
  return res.data;
}

export async function importSave(expenses: Omit<Expense, 'id'>[]): Promise<{ saved: Expense[]; total: number }> {
  const fn = httpsCallable<{ action: 'save'; expenses: Omit<Expense, 'id'>[] }, { saved: Expense[]; total: number }>(assertFunctions(), 'expensesImport');
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
  const fn = httpsCallable<{ action: 'categorise'; batchSize?: number }, MigrateCategoriseResult>(assertFunctions(), 'expensesMigrate');
  const res = await fn({ action: 'categorise', batchSize });
  return res.data;
}

export async function reanalyseExpenses(payload: { financialYear?: string; type?: 'tax' | 'spending' }): Promise<{ updated: number; total: number }> {
  const fn = httpsCallable<typeof payload, { updated: number; total: number }>(assertFunctions(), 'expensesReanalyse');
  const res = await fn(payload);
  return res.data;
}
