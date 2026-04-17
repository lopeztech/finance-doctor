'use client';

import { useEffect, useState } from 'react';
import { isGuest } from './guest-store';

export function useGuestMode(): { guest: boolean; ready: boolean } {
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGuest(isGuest());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fd_guest') setGuest(isGuest());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { guest, ready };
}
