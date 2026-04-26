import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';
import type { Budget } from './budgets-types';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function budgetsCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'budgets');
}

export async function listBudgets(): Promise<Budget[]> {
  if (guest.isGuest()) return guest.listBudgets();
  const snap = await getDocs(query(budgetsCollection(), orderBy('amount', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget));
}

export async function addBudget(data: Omit<Budget, 'id'>): Promise<Budget> {
  if (guest.isGuest()) return guest.addBudget(data);
  const ref = doc(budgetsCollection());
  const budget: Budget = { id: ref.id, ...data };
  await setDoc(ref, budget);
  return budget;
}

export async function updateBudget(id: string, patch: Partial<Budget>): Promise<void> {
  if (guest.isGuest()) { guest.updateBudget(id, patch); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'budgets', id);
  await updateDoc(ref, patch as Record<string, unknown>);
}

export async function deleteBudget(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteBudget(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'budgets', id);
  await deleteDoc(ref);
}

export function watchBudgets(onChange: (budgets: Budget[]) => void): () => void {
  if (guest.isGuest()) {
    onChange(guest.listBudgets());
    return () => {};
  }
  try {
    const q = query(budgetsCollection(), orderBy('amount', 'desc'));
    return onSnapshot(q, snap => {
      onChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
    }, () => onChange([]));
  } catch {
    return () => {};
  }
}
