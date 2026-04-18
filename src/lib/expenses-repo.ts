import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  orderBy,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Expense } from './types';
import * as guest from './guest-store';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function expensesCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'expenses');
}

export async function listExpenses(fy: string = 'all'): Promise<Expense[]> {
  if (guest.isGuest()) return guest.listExpenses(fy);
  const col = expensesCollection();
  const q = fy === 'all'
    ? query(col)
    : query(col, where('financialYear', '==', fy), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  if (fy === 'all') expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return expenses;
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<void> {
  if (guest.isGuest()) { guest.updateExpense(id, data); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'expenses', id);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function addExpenses(items: Omit<Expense, 'id'>[]): Promise<Expense[]> {
  if (guest.isGuest()) return items.map(item => guest.addExpense(item));
  if (!db) throw new Error('Firestore is not initialised');
  const col = expensesCollection();
  const batch = writeBatch(db);
  const saved: Expense[] = [];
  for (const item of items) {
    const ref = doc(col);
    const expense: Expense = { id: ref.id, ...item };
    batch.set(ref, expense);
    saved.push(expense);
  }
  await batch.commit();
  return saved;
}

export async function deleteExpense(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteExpense(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'expenses', id);
  await deleteDoc(ref);
}
