import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== 'undefined';
const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (isBrowser && !hasConfig) {
  console.warn('[firebase] NEXT_PUBLIC_FIREBASE_* env vars are not set; client SDK is disabled.');
}

const shouldInit = isBrowser && hasConfig;

export const app: FirebaseApp | null = shouldInit
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const functions: Functions | null = app ? getFunctions(app, 'australia-southeast1') : null;
