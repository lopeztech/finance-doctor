import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/use-auth-user', () => {
  const stableAuth = { user: null, ready: true };
  return { useAuthUser: () => stableAuth };
});

jest.mock('@/lib/use-guest-mode', () => {
  const stableGuest = { guest: false, ready: true };
  return { useGuestMode: () => stableGuest };
});

const mockGetPrefs = jest.fn();
jest.mock('@/lib/user-preferences-repo', () => ({
  getUserPreferences: () => mockGetPrefs(),
  saveUserPreferences: jest.fn(),
}));

import { PreferencesProvider, usePreferences } from '@/lib/use-preferences';
import { getCachedPreferences } from '@/lib/preferences-cache';

function Probe() {
  const { prefs, ready } = usePreferences();
  return (
    <div>
      <span data-testid="ready">{ready ? 'yes' : 'no'}</span>
      <span data-testid="homepage">{prefs.defaults.homepage}</span>
    </div>
  );
}

describe('PreferencesProvider when logged out', () => {
  it('skips the repo call and reports defaults', async () => {
    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('yes'));
    expect(screen.getByTestId('homepage').textContent).toBe('/');
    expect(mockGetPrefs).not.toHaveBeenCalled();
    expect(getCachedPreferences().defaults.homepage).toBe('/');
  });
});
