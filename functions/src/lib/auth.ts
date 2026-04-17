import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

export function requireUserEmail(request: CallableRequest<unknown>): string {
  const email = request.auth?.token?.email;
  if (!email) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  return email;
}
