import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Investment } from './types';
import * as guest from './guest-store';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function investmentsCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'investments');
}

export async function listInvestments(): Promise<Investment[]> {
  if (guest.isGuest()) return guest.listInvestments();
  const snap = await getDocs(query(investmentsCollection(), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment));
}

export async function addInvestment(data: Omit<Investment, 'id'>): Promise<Investment> {
  if (guest.isGuest()) return guest.addInvestment(data);
  const ref = await addDoc(investmentsCollection(), data);
  await updateDoc(ref, { id: ref.id });
  return { id: ref.id, ...data } as Investment;
}

export async function updateInvestment(id: string, data: Partial<Investment>): Promise<void> {
  if (guest.isGuest()) { guest.updateInvestment(id, data); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'investments', id);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function deleteInvestment(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteInvestment(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'investments', id);
  await deleteDoc(ref);
}
