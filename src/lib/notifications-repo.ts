import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  onSnapshot,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';
import {
  DEFAULT_PREFERENCES,
  isInAppEnabled,
  type Notification,
  type NotificationKind,
  type NotificationPreferences,
} from './notification-types';
import { getNotificationPreferences } from './notification-preferences-repo';

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function notificationsCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'notifications');
}

interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  /** Deterministic id for de-duplication (e.g. `tax-deadline-2025-2026-30`). */
  dedupeId?: string;
}

/**
 * Write a notification, honouring the user's per-kind preferences. No-op when
 * the kind is disabled or when running in guest/non-auth mode that can't reach
 * Firestore. Returns true if the notification was written (or already exists).
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  let prefs: NotificationPreferences;
  try {
    prefs = await getNotificationPreferences();
  } catch {
    prefs = { ...DEFAULT_PREFERENCES };
  }
  const channel = prefs.perKind[input.kind];
  if (channel === 'off') return false;
  if (!isInAppEnabled(channel)) return false;

  if (guest.isGuest()) {
    guest.addNotification({
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link,
      dedupeId: input.dedupeId,
    });
    return true;
  }

  if (!auth?.currentUser?.email || !db) return false;

  const col = notificationsCollection();
  const ref = input.dedupeId ? doc(col, input.dedupeId) : doc(col);
  const payload: Notification = {
    id: ref.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    link: input.link,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  try {
    // setDoc with deterministic id is idempotent — repeated emits reuse the
    // same doc instead of producing duplicates.
    await setDoc(ref, payload, { merge: !!input.dedupeId });
    return true;
  } catch {
    return false;
  }
}

export async function listNotifications(max: number = 50): Promise<Notification[]> {
  if (guest.isGuest()) return guest.listNotifications().slice(0, max);
  try {
    const col = notificationsCollection();
    const q = query(col, orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
  } catch {
    return [];
  }
}

export function watchUnreadCount(onChange: (count: number) => void): () => void {
  if (guest.isGuest()) {
    onChange(guest.listNotifications().filter(n => !n.readAt).length);
    return () => {};
  }
  try {
    const col = notificationsCollection();
    const q = query(col, where('readAt', '==', null));
    return onSnapshot(q, snap => onChange(snap.size), () => onChange(0));
  } catch {
    return () => {};
  }
}

export function watchRecentNotifications(
  max: number,
  onChange: (notifications: Notification[]) => void,
): () => void {
  if (guest.isGuest()) {
    onChange(guest.listNotifications().slice(0, max));
    return () => {};
  }
  try {
    const col = notificationsCollection();
    const q = query(col, orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, snap => {
      onChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    }, () => onChange([]));
  } catch {
    return () => {};
  }
}

export async function markRead(id: string): Promise<void> {
  if (guest.isGuest()) { guest.markNotificationRead(id); return; }
  if (!db) return;
  const ref = doc(db, 'users', getUserKey(), 'notifications', id);
  await updateDoc(ref, { readAt: new Date().toISOString() });
}

export async function markAllRead(): Promise<void> {
  if (guest.isGuest()) { guest.markAllNotificationsRead(); return; }
  if (!db) return;
  const col = notificationsCollection();
  const q = query(col, where('readAt', '==', null));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  snap.docs.forEach(d => batch.update(d.ref, { readAt: now }));
  await batch.commit();
}
