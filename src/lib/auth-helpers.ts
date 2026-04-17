import { headers } from 'next/headers';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function ensureAdminApp() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  }
}

export async function getAuthUserId(): Promise<string | null> {
  const authz = (await headers()).get('authorization');
  if (!authz?.startsWith('Bearer ')) return null;
  const token = authz.slice(7);

  try {
    ensureAdminApp();
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.email || decoded.uid;
  } catch {
    return null;
  }
}
