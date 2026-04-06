import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;

function getDb(): Firestore {
  if (!db) {
    if (getApps().length === 0) {
      // On Cloud Run, uses Application Default Credentials automatically
      app = initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
      });
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
  }
  return db;
}

export { getDb };
