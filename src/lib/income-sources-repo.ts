import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { IncomeSource } from './types';
import * as guest from './guest-store';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function incomeSourcesCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'income-sources');
}

export async function listIncomeSources(): Promise<IncomeSource[]> {
  if (guest.isGuest()) return guest.listIncomeSources();
  const snap = await getDocs(incomeSourcesCollection());
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeSource));
}

export async function addIncomeSource(data: Omit<IncomeSource, 'id'>): Promise<IncomeSource> {
  if (guest.isGuest()) return guest.addIncomeSource(data);
  const ref = doc(incomeSourcesCollection());
  const item: IncomeSource = { id: ref.id, ...data };
  await setDoc(ref, item);
  return item;
}

export async function updateIncomeSource(id: string, patch: Partial<IncomeSource>): Promise<void> {
  if (guest.isGuest()) { guest.updateIncomeSource(id, patch); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'income-sources', id);
  await updateDoc(ref, patch as Record<string, unknown>);
}

export async function deleteIncomeSource(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteIncomeSource(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'income-sources', id);
  await deleteDoc(ref);
}
