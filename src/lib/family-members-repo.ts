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
import type { FamilyMember } from './types';
import * as guest from './guest-store';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function familyMembersCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'family-members');
}

export async function listFamilyMembers(): Promise<FamilyMember[]> {
  if (guest.isGuest()) return guest.listFamilyMembers();
  const snap = await getDocs(query(familyMembersCollection(), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember));
}

export async function addFamilyMember(data: Omit<FamilyMember, 'id'>): Promise<FamilyMember> {
  if (guest.isGuest()) return guest.addFamilyMember(data);
  const ref = doc(familyMembersCollection());
  const member: FamilyMember = {
    id: ref.id,
    name: data.name,
    salary: data.salary,
    ...(data.job ? { job: data.job } : {}),
  };
  await setDoc(ref, member);
  return member;
}

export async function updateFamilyMember(id: string, data: Partial<FamilyMember>): Promise<void> {
  if (guest.isGuest()) { guest.updateFamilyMember(id, data); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'family-members', id);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function deleteFamilyMember(id: string): Promise<void> {
  if (guest.isGuest()) { guest.deleteFamilyMember(id); return; }
  if (!db) throw new Error('Firestore is not initialised');
  const ref = doc(db, 'users', getUserKey(), 'family-members', id);
  await deleteDoc(ref);
}
