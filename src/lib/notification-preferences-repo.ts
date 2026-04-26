import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';
import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from './notification-types';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function prefsRef() {
  if (!db) throw new Error('Firestore is not initialised');
  return doc(db, 'users', getUserKey(), 'meta', 'notification-preferences');
}

function withDefaults(partial: Partial<NotificationPreferences> | undefined): NotificationPreferences {
  return {
    perKind: { ...DEFAULT_PREFERENCES.perKind, ...(partial?.perKind || {}) },
    quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...(partial?.quietHours || {}) },
  };
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (guest.isGuest()) return withDefaults(guest.getNotificationPreferences());
  try {
    const snap = await getDoc(prefsRef());
    return withDefaults(snap.exists() ? (snap.data() as Partial<NotificationPreferences>) : {});
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  if (guest.isGuest()) { guest.setNotificationPreferences(prefs); return; }
  await setDoc(prefsRef(), prefs);
}
