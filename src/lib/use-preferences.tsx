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
import { getUserPreferences, saveUserPreferences } from './user-preferences-repo';
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from './user-preferences-types';
import { useAuthUser } from './use-auth-user';
import { useGuestMode } from './use-guest-mode';
import { setCachedPreferences } from './preferences-cache';

interface PreferencesContextValue {
  prefs: UserPreferences;
  ready: boolean;
  update: (patch: Partial<UserPreferences>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

// Re-export the synchronous helpers so callers don't have to know the cache is
// in a separate module. The React-free entry point lives in preferences-cache.
export { getCachedPreferences, isAiAdviceAllowed, isAiContextOptOut } from './preferences-cache';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuthUser();
  const { guest, ready: guestReady } = useGuestMode();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await getUserPreferences();
      setCachedPreferences(next);
      setPrefs(next);
    } catch {
      setCachedPreferences({ ...DEFAULT_PREFERENCES });
      setPrefs({ ...DEFAULT_PREFERENCES });
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !guestReady) return;
    if (!user && !guest) {
      // Logged out — defaults only, no fetch.
      setCachedPreferences({ ...DEFAULT_PREFERENCES });
      setPrefs({ ...DEFAULT_PREFERENCES });
      setReady(true);
      return;
    }
    reload();
  }, [authReady, guestReady, user, guest, reload]);

  // Density class on the body element. Toggled here so it survives navigation.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cls = 'density-compact';
    if (prefs.display.density === 'compact') document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => { document.body.classList.remove(cls); };
  }, [prefs.display.density]);

  const update = useCallback(async (patch: Partial<UserPreferences>) => {
    const merged: UserPreferences = {
      display: { ...prefs.display, ...(patch.display || {}) },
      defaults: { ...prefs.defaults, ...(patch.defaults || {}) },
      privacy: { ...prefs.privacy, ...(patch.privacy || {}) },
      onboardedAt: patch.onboardedAt ?? prefs.onboardedAt,
    };
    setCachedPreferences(merged);
    setPrefs(merged);
    try {
      await saveUserPreferences(merged);
    } catch {
      // Persistence failed but local state already reflects the change so the
      // user sees their toggle take effect; next mount will re-read truth.
    }
  }, [prefs]);

  const value = useMemo(() => ({ prefs, ready, update }), [prefs, ready, update]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/**
 * Returns the active preferences. When called outside a `PreferencesProvider`
 * (e.g. in unit tests that render a single page), falls back to the defaults
 * with a no-op `update` so callers don't need to mount the provider.
 */
export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (ctx) return ctx;
  return {
    prefs: { ...DEFAULT_PREFERENCES },
    ready: true,
    update: async () => {},
  };
}
