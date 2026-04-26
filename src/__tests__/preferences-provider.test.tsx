import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from '@/lib/user-preferences-types';

const mockGetPrefs = jest.fn<Promise<UserPreferences>, []>();
const mockSavePrefs = jest.fn<Promise<void>, [UserPreferences]>();

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

// Stable references inside the factory so the provider's useEffect doesn't
// refire on every render (otherwise reload() repeatedly stomps the cache).
jest.mock('@/lib/use-auth-user', () => {
  const stableAuth = { user: { email: 'test@example.com' }, ready: true };
  return { useAuthUser: () => stableAuth };
});

jest.mock('@/lib/use-guest-mode', () => {
  const stableGuest = { guest: false, ready: true };
  return { useGuestMode: () => stableGuest };
});

jest.mock('@/lib/user-preferences-repo', () => ({
  getUserPreferences: () => mockGetPrefs(),
  saveUserPreferences: (p: UserPreferences) => mockSavePrefs(p),
}));

import { PreferencesProvider, usePreferences } from '@/lib/use-preferences';
import { getCachedPreferences } from '@/lib/preferences-cache';

function Probe({ patch }: { patch?: Partial<UserPreferences> }) {
  const { prefs, ready, update } = usePreferences();
  return (
    <div>
      <span data-testid="ready">{ready ? 'yes' : 'no'}</span>
      <span data-testid="homepage">{prefs.defaults.homepage}</span>
      <span data-testid="density">{prefs.display.density}</span>
      <span data-testid="ai">{String(prefs.privacy.aiAdviceEnabled)}</span>
      <button data-testid="apply" onClick={() => { if (patch) update(patch); }}>apply</button>
    </div>
  );
}

beforeEach(() => {
  mockGetPrefs.mockReset();
  mockSavePrefs.mockReset().mockResolvedValue(undefined);
  document.body.classList.remove('density-compact');
});

describe('PreferencesProvider', () => {
  it('hydrates prefs from the repo on mount and exposes them via the hook', async () => {
    const stored: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      defaults: { ...DEFAULT_PREFERENCES.defaults, homepage: '/expenses' },
      privacy: { aiAdviceEnabled: false, aiContextOptOut: true },
    };
    mockGetPrefs.mockResolvedValue(stored);

    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('yes'));
    expect(screen.getByTestId('homepage').textContent).toBe('/expenses');
    expect(screen.getByTestId('ai').textContent).toBe('false');
    expect(getCachedPreferences().privacy.aiAdviceEnabled).toBe(false);
  });

  it('falls back to defaults when the repo throws', async () => {
    mockGetPrefs.mockRejectedValue(new Error('boom'));

    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('yes'));
    expect(screen.getByTestId('homepage').textContent).toBe('/');
    expect(getCachedPreferences().defaults.homepage).toBe('/');
  });

  it('toggles the density-compact body class when density changes', async () => {
    mockGetPrefs.mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      display: { ...DEFAULT_PREFERENCES.display, density: 'compact' },
    });

    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(document.body.classList.contains('density-compact')).toBe(true));
  });

  it('update merges patches, saves through the repo, and refreshes the cache', async () => {
    mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFERENCES });

    render(
      <PreferencesProvider>
        <Probe patch={{ defaults: { ...DEFAULT_PREFERENCES.defaults, homepage: '/investments' } }} />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('yes'));
    fireEvent.click(screen.getByTestId('apply'));

    await waitFor(() => expect(screen.getByTestId('homepage').textContent).toBe('/investments'));
    expect(mockSavePrefs).toHaveBeenCalledTimes(1);
    expect(mockSavePrefs.mock.calls[0][0].defaults.homepage).toBe('/investments');
    expect(getCachedPreferences().defaults.homepage).toBe('/investments');
  });

  it('update keeps local state when the repo save fails', async () => {
    mockGetPrefs.mockResolvedValue({ ...DEFAULT_PREFERENCES });
    mockSavePrefs.mockRejectedValueOnce(new Error('write blocked'));

    render(
      <PreferencesProvider>
        <Probe patch={{ display: { ...DEFAULT_PREFERENCES.display, density: 'compact' } }} />
      </PreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('yes'));
    fireEvent.click(screen.getByTestId('apply'));

    await waitFor(() => expect(screen.getByTestId('density').textContent).toBe('compact'));
  });
});
