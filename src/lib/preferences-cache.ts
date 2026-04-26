import { DEFAULT_PREFERENCES, type UserPreferences } from './user-preferences-types';

// Synchronous cache so non-React callers (functions-client, dispatch sites)
// can read user preferences without prop-drilling. The React provider keeps
// it fresh by calling `setCachedPreferences` whenever prefs load or change.
let cached: UserPreferences = { ...DEFAULT_PREFERENCES };

export function getCachedPreferences(): UserPreferences {
  return cached;
}

export function setCachedPreferences(prefs: UserPreferences): void {
  cached = prefs;
}

export function isAiAdviceAllowed(): boolean {
  return cached.privacy.aiAdviceEnabled !== false;
}

export function isAiContextOptOut(): boolean {
  return cached.privacy.aiContextOptOut === true;
}
