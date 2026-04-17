import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Expense } from './types';

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
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'expenses', id);
  await updateDoc(ref, data as Record<string, unknown>);
}
