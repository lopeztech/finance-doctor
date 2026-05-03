'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FamilyMember } from './types';
import { listFamilyMembers } from './family-members-repo';
import { useAuthUser } from './use-auth-user';
import { useGuestMode } from './use-guest-mode';

const STORAGE_KEY = 'finance-doctor.member';

interface MemberContextValue {
  /** Selected member name, or empty string for "Everyone". */
  memberId: string;
  setMember: (id: string) => void;
  members: FamilyMember[];
  ready: boolean;
  reload: () => Promise<void>;
}

const MemberContext = createContext<MemberContextValue | undefined>(undefined);

export function MemberProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuthUser();
  const { guest, ready: guestReady } = useGuestMode();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [memberId, setMemberId] = useState<string>('');
  const [ready, setReady] = useState(false);

  // Hydrate selection from localStorage once on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setMemberId(stored);
    } catch {}
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await listFamilyMembers();
      setMembers(list);
      setMemberId(prev => {
        if (prev && !list.some(m => m.name === prev)) {
          // Persisted member no longer exists — silently reset and clear storage.
          try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
          return '';
        }
        return prev;
      });
    } catch {
      setMembers([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !guestReady) return;
    if (!user && !guest) {
      setMembers([]);
      setReady(true);
      return;
    }
    reload();
  }, [authReady, guestReady, user, guest, reload]);

  const setMember = useCallback((id: string) => {
    setMemberId(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ memberId, setMember, members, ready, reload }),
    [memberId, setMember, members, ready, reload],
  );

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

/**
 * Returns the active member selection. Falls back to a no-op default when
 * called outside a `MemberProvider` (e.g. unit tests rendering one page).
 */
export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext);
  if (ctx) return ctx;
  return {
    memberId: '',
    setMember: () => {},
    members: [],
    ready: true,
    reload: async () => {},
  };
}
