import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;

export function getDb(): Firestore {
  if (!db) {
    app = getApps().length ? getApps()[0] : initializeApp();
    db = getFirestore(app);
  }
  return db;
}
