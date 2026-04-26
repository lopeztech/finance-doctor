import { GUEST_SEED } from './guest-seed';
import type { Expense, FamilyMember, Investment, IncomeSource } from './types';
import type { Notification, NotificationKind, NotificationPreferences } from './notification-types';
import type { UserPreferences } from './user-preferences-types';

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
  incomeSources?: IncomeSource[];
  notifications?: Notification[];
  notificationPreferences?: NotificationPreferences;
  userPreferences?: UserPreferences;
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

const TRADED_TYPES = new Set(['Australian Shares', 'International Shares', 'ETFs', 'Cryptocurrency']);

export function mockRefreshPrices(ids?: string[]): {
  total: number;
  updated: number;
  failed: number;
  results: {
    id: string;
    ticker: string;
    ok: boolean;
    price?: number;
    currency?: string;
    fxToAud?: number;
    currentValue?: number;
    previousValue?: number;
    updatedAt?: string;
    error?: string;
  }[];
} {
  const eligible = state.investments.filter(inv => {
    if (!inv.ticker || !TRADED_TYPES.has(inv.type) || !inv.units || inv.units <= 0) return false;
    if (ids && ids.length > 0) return ids.includes(inv.id);
    return true;
  });
  const nowIso = new Date().toISOString();
  const results = eligible.map(inv => {
    // Nudge price ±2.5% deterministically off current value to simulate a refresh.
    const seed = (inv.id.charCodeAt(0) + inv.id.length + nowIso.length) % 50;
    const drift = 1 + (seed - 25) / 1000;
    const newValue = Number((inv.currentValue * drift).toFixed(2));
    const newPrice = Number((newValue / (inv.units || 1)).toFixed(4));
    const previousValue = inv.currentValue;
    state.investments = state.investments.map(i =>
      i.id === inv.id
        ? { ...i, currentValue: newValue, lastPrice: newPrice, lastPriceCurrency: 'AUD', lastPriceUpdate: nowIso }
        : i,
    );
    return {
      id: inv.id,
      ticker: inv.ticker!.toUpperCase(),
      ok: true,
      price: newPrice,
      currency: 'AUD',
      fxToAud: 1,
      currentValue: newValue,
      previousValue,
      updatedAt: nowIso,
    };
  });
  return { total: eligible.length, updated: results.length, failed: 0, results };
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

// Income sources -----------------------------------------------------------

export function listIncomeSources(): IncomeSource[] {
  return [...(state.incomeSources || [])];
}

export function addIncomeSource(data: Omit<IncomeSource, 'id'>): IncomeSource {
  const item: IncomeSource = { id: rid('inc'), ...data };
  state.incomeSources = [...(state.incomeSources || []), item];
  return item;
}

export function updateIncomeSource(id: string, patch: Partial<IncomeSource>) {
  state.incomeSources = (state.incomeSources || []).map(i => i.id === id ? { ...i, ...patch } : i);
}

export function deleteIncomeSource(id: string) {
  state.incomeSources = (state.incomeSources || []).filter(i => i.id !== id);
}

// Notifications -----------------------------------------------------------

export function listNotifications(): Notification[] {
  return [...(state.notifications || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

interface AddNotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  dedupeId?: string;
}

export function addNotification(input: AddNotificationInput): Notification {
  const list = state.notifications || [];
  if (input.dedupeId) {
    const existing = list.find(n => n.id === input.dedupeId);
    if (existing) return existing;
  }
  const notif: Notification = {
    id: input.dedupeId || rid('n'),
    kind: input.kind,
    title: input.title,
    body: input.body,
    link: input.link,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  state.notifications = [notif, ...list];
  return notif;
}

export function markNotificationRead(id: string) {
  const now = new Date().toISOString();
  state.notifications = (state.notifications || []).map(n =>
    n.id === id ? { ...n, readAt: n.readAt || now } : n,
  );
}

export function markAllNotificationsRead() {
  const now = new Date().toISOString();
  state.notifications = (state.notifications || []).map(n => ({ ...n, readAt: n.readAt || now }));
}

export function getNotificationPreferences(): NotificationPreferences | undefined {
  return state.notificationPreferences;
}

export function setNotificationPreferences(prefs: NotificationPreferences) {
  state.notificationPreferences = prefs;
}

// User preferences --------------------------------------------------------

export function getUserPreferences(): UserPreferences | undefined {
  return state.userPreferences;
}

export function setUserPreferences(prefs: UserPreferences) {
  state.userPreferences = prefs;
}
