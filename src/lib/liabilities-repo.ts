import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';
import type { Liability } from './networth-types';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function liabilitiesCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'liabilities');
}

export async function listLiabilities(): Promise<Liability[]> {
  if (guest.isGuest()) return guest.listLiabilities();
  try {
    const snap = await getDocs(query(liabilitiesCollection(), orderBy('currentBalance', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Liability));
  } catch {
    return [];
  }
}

export async function addLiability(data: Omit<Liability, 'id'>): Promise<Liability> {
  if (guest.isGuest()) return guest.addLiability(data);
  const ref = doc(liabilitiesCollection());
  const liability: Liability = { id: ref.id, ...data };
  await setDoc(ref, liability);
  return liability;
}

export async function updateLiability(id: string, patch: Partial<Liability>): Promise<void> {
  if (guest.isGuest()) { guest.updateLiability(id, patch); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'liabilities', id);
  await updateDoc(ref, patch as Record<string, unknown>);
}

export async function deleteLiability(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteLiability(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'liabilities', id);
  await deleteDoc(ref);
}
