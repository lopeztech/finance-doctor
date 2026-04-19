import { GUEST_SEED } from './guest-seed';
import type { Expense, FamilyMember, Investment } from './types';

const FLAG_KEY = 'fd_guest';

export function isGuest(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; }
}

export function enableGuest() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(FLAG_KEY, '1'); } catch {}
}

export function exitGuest() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(FLAG_KEY); } catch {}
  reset();
}

interface CategoryRule {
  id: string;
  pattern: string;
  taxCategory?: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface CategorySettings {
  types: Record<string, 'essential' | 'committed' | 'discretionary'>;
  excluded: string[];
}

interface GuestState {
  expenses: Expense[];
  investments: Investment[];
  familyMembers: FamilyMember[];
  categoryRules: CategoryRule[];
  adviceChats: Record<string, ChatMessage[] | string[]>;
  categorySettings?: CategorySettings;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

let state: GuestState = clone(GUEST_SEED);

export function reset() {
  state = clone(GUEST_SEED);
}

function rid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// Expenses -----------------------------------------------------------------

export function listExpenses(fy: string = 'all'): Expense[] {
  const all = [...state.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (fy === 'all') return all;
  return all.filter(e => e.financialYear === fy);
}

export function updateExpense(id: string, patch: Partial<Expense>) {
  state.expenses = state.expenses.map(e => e.id === id ? { ...e, ...patch } : e);
}

export function addExpense(data: Omit<Expense, 'id'>): Expense {
  const exp: Expense = { id: rid('e'), ...data };
  state.expenses.push(exp);
  return exp;
}

export function deleteExpense(id: string) {
  state.expenses = state.expenses.filter(e => e.id !== id);
}

// Investments --------------------------------------------------------------

export function listInvestments(): Investment[] {
  return [...state.investments];
}

export function addInvestment(data: Omit<Investment, 'id'>): Investment {
  const inv: Investment = { id: rid('inv'), ...data };
  state.investments.push(inv);
  return inv;
}

export function updateInvestment(id: string, patch: Partial<Investment>) {
  state.investments = state.investments.map(i => i.id === id ? { ...i, ...patch } : i);
}

export function deleteInvestment(id: string) {
  state.investments = state.investments.filter(i => i.id !== id);
}

// Family members -----------------------------------------------------------

export function listFamilyMembers(): FamilyMember[] {
  return [...state.familyMembers];
}

export function addFamilyMember(data: Omit<FamilyMember, 'id'>): FamilyMember {
  const m: FamilyMember = { id: rid('fm'), ...data };
  state.familyMembers.push(m);
  return m;
}

export function updateFamilyMember(id: string, patch: Partial<FamilyMember>) {
  state.familyMembers = state.familyMembers.map(m => m.id === id ? { ...m, ...patch } : m);
}

export function deleteFamilyMember(id: string) {
  state.familyMembers = state.familyMembers.filter(m => m.id !== id);
}

// Category rules -----------------------------------------------------------

export function listCategoryRules(): CategoryRule[] {
  return [...state.categoryRules];
}

export function upsertCategoryRule(data: Omit<CategoryRule, 'id'>): CategoryRule {
  const existing = state.categoryRules.find(r => r.pattern.toLowerCase() === data.pattern.toLowerCase());
  if (existing) {
    Object.assign(existing, data);
    return existing;
  }
  const rule: CategoryRule = { id: rid('r'), ...data };
  state.categoryRules.push(rule);
  return rule;
}

export function deleteCategoryRule(id: string) {
  state.categoryRules = state.categoryRules.filter(r => r.id !== id);
}

// Advice chats -------------------------------------------------------------

export function getAdviceChat<T = ChatMessage>(type: string): T[] {
  return (state.adviceChats[type] as T[] | undefined) ?? [];
}

export function setAdviceChat<T = ChatMessage>(type: string, history: T[]) {
  state.adviceChats[type] = history as ChatMessage[] | string[];
}

// Category settings --------------------------------------------------------

export function getCategorySettings(): CategorySettings {
  return state.categorySettings
    ? { types: { ...state.categorySettings.types }, excluded: [...state.categorySettings.excluded] }
    : { types: {}, excluded: [] };
}

export function setCategorySettings(settings: CategorySettings) {
  state.categorySettings = {
    types: { ...settings.types },
    excluded: [...settings.excluded],
  };
}
