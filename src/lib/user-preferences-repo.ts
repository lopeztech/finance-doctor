import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';
import {
  DEFAULT_PREFERENCES,
  withDefaults,
  type UserPreferences,
} from './user-preferences-types';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function profileRef() {
  if (!db) throw new Error('Firestore is not initialised');
  return doc(db, 'users', getUserKey(), 'meta', 'profile');
}

export async function getUserPreferences(): Promise<UserPreferences> {
  if (guest.isGuest()) return withDefaults(guest.getUserPreferences());
  try {
    const snap = await getDoc(profileRef());
    return withDefaults(snap.exists() ? (snap.data() as Partial<UserPreferences>) : {});
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  if (guest.isGuest()) { guest.setUserPreferences(prefs); return; }
  await setDoc(profileRef(), prefs, { merge: true });
}
