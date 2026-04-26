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
import type { Goal } from './goals-types';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function goalsCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'goals');
}

export async function listGoals(): Promise<Goal[]> {
  if (guest.isGuest()) return guest.listGoals();
  try {
    const snap = await getDocs(query(goalsCollection(), orderBy('startedAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
  } catch {
    return [];
  }
}

export async function addGoal(data: Omit<Goal, 'id'>): Promise<Goal> {
  if (guest.isGuest()) return guest.addGoal(data);
  const ref = doc(goalsCollection());
  const goal: Goal = { id: ref.id, ...data };
  await setDoc(ref, goal);
  return goal;
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  if (guest.isGuest()) { guest.updateGoal(id, patch); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'goals', id);
  await updateDoc(ref, patch as Record<string, unknown>);
}

export async function deleteGoal(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteGoal(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'goals', id);
  await deleteDoc(ref);
}

export function watchGoals(onChange: (goals: Goal[]) => void): () => void {
  if (guest.isGuest()) {
    onChange(guest.listGoals());
    return () => {};
  }
  try {
    const q = query(goalsCollection(), orderBy('startedAt', 'desc'));
    return onSnapshot(q, snap => {
      onChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    }, () => onChange([]));
  } catch {
    return () => {};
  }
}
