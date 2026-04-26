'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthUser } from '@/lib/use-auth-user';
import { useGuestMode } from '@/lib/use-guest-mode';
import { usePreferences } from '@/lib/use-preferences';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready: authReady } = useAuthUser();
  const { guest, ready: guestReady } = useGuestMode();
  const { prefs, ready: prefsReady } = usePreferences();
  const ready = authReady && guestReady;
  const authenticated = Boolean(user) || guest;

  useEffect(() => {
    if (!ready) return;
    if (!authenticated && pathname !== '/login') router.replace('/login');
    if (authenticated && pathname === '/login') {
      // Wait for prefs so we honour the user's chosen homepage on first paint.
      // Falls back to '/' if prefs aren't ready yet (defaults match anyway).
      const dest = prefsReady ? prefs.defaults.homepage : '/';
      router.replace(dest);
    }
  }, [ready, authenticated, pathname, router, prefsReady, prefs.defaults.homepage]);

  if (!ready) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <i className="fa fa-spinner fa-spin fa-2x text-muted"></i>
      </div>
    );
  }

  if (!authenticated && pathname !== '/login') return null;

  return <>{children}</>;
}
