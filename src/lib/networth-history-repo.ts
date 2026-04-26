import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';
import type { NetWorthSnapshot } from './networth-types';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function historyCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'networth-history');
}

export async function listNetWorthHistory(): Promise<NetWorthSnapshot[]> {
  if (guest.isGuest()) return guest.listNetWorthHistory();
  try {
    const snap = await getDocs(query(historyCollection(), orderBy('id', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as NetWorthSnapshot));
  } catch {
    return [];
  }
}

export async function saveNetWorthSnapshot(snapshot: NetWorthSnapshot): Promise<void> {
  if (guest.isGuest()) { guest.saveNetWorthSnapshot(snapshot); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'networth-history', snapshot.id);
  await setDoc(ref, snapshot, { merge: true });
}
