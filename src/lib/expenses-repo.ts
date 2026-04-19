import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  orderBy,
  onSnapshot,
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
  // undefined values mean "remove the field" in our callers; Firestore rejects
  // undefined so translate to deleteField() sentinels.
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(ref, payload);
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

export function watchPendingCategorisation(
  onChange: (counts: { pending: number; failed: number }) => void,
): () => void {
  if (guest.isGuest()) return () => {};
  try {
    const col = expensesCollection();
    const q = query(col, where('categorisationStatus', 'in', ['pending', 'failed']));
    return onSnapshot(q, snap => {
      let pending = 0;
      let failed = 0;
      snap.forEach(d => {
        const s = (d.data() as Expense).categorisationStatus;
        if (s === 'pending') pending++;
        else if (s === 'failed') failed++;
      });
      onChange({ pending, failed });
    }, () => onChange({ pending: 0, failed: 0 }));
  } catch {
    return () => {};
  }
}

export async function deleteExpense(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteExpense(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'expenses', id);
  await deleteDoc(ref);
}
