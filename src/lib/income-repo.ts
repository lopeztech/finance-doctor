import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  deleteField,
  query,
  orderBy,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Income } from './types';
import * as guest from './guest-store';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function incomeCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'income');
}

export async function listIncome(): Promise<Income[]> {
  if (guest.isGuest()) return [];
  const snap = await getDocs(query(incomeCollection(), orderBy('date', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Income));
}

export async function updateIncome(id: string, patch: Partial<Income>): Promise<void> {
  if (guest.isGuest()) return;
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'income', id);
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(ref, payload);
}

export async function deleteIncome(id: string): Promise<void> {
  if (guest.isGuest()) return;
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'income', id);
  await deleteDoc(ref);
}
