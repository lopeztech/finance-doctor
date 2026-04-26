import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import {
  isWithinQuietHours,
  isInAppEnabled,
  type NotificationPreferences,
} from '@/lib/notification-types';
import { currentFinancialYear, daysUntilEofy, daysUntilLodgement } from '@/lib/tax-deadline';

const mockUnreadWatchers: Array<(c: number) => void> = [];
const mockListWatchers: Array<(items: unknown[]) => void> = [];
const mockMarkRead = jest.fn().mockResolvedValue(undefined);
const mockMarkAllRead = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/firebase', () => ({ auth: null, db: null, app: null, functions: null }));

jest.mock('@/lib/notifications-repo', () => ({
  watchUnreadCount: (cb: (c: number) => void) => {
    mockUnreadWatchers.push(cb);
    cb(0);
    return () => {
      const i = mockUnreadWatchers.indexOf(cb);
      if (i >= 0) mockUnreadWatchers.splice(i, 1);
    };
  },
  watchRecentNotifications: (_max: number, cb: (items: unknown[]) => void) => {
    mockListWatchers.push(cb);
    cb([]);
    return () => {
      const i = mockListWatchers.indexOf(cb);
      if (i >= 0) mockListWatchers.splice(i, 1);
    };
  },
  markRead: (...args: unknown[]) => mockMarkRead(...args),
  markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import DropdownNotification from '@/components/header/dropdown/notification';

beforeEach(() => {
  mockUnreadWatchers.length = 0;
  mockListWatchers.length = 0;
  mockMarkRead.mockClear();
  mockMarkAllRead.mockClear();
  mockPush.mockClear();
});

describe('DropdownNotification', () => {
  it('hides the badge when there are no unread notifications', () => {
    render(<DropdownNotification />);
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
    expect(screen.getByText('NOTIFICATIONS')).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('caps the badge at 9+', async () => {
    render(<DropdownNotification />);
    await waitFor(() => expect(mockUnreadWatchers.length).toBeGreaterThan(0));
    await act(async () => { mockUnreadWatchers[0](42); });
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('renders notification items grouped and marks one read on click', async () => {
    render(<DropdownNotification />);
    await waitFor(() => expect(mockListWatchers.length).toBeGreaterThan(0));
    const todayIso = new Date().toISOString();
    const earlierIso = new Date(Date.now() - 4 * 86_400_000).toISOString();
    await act(async () => {
      mockListWatchers[0]([
        { id: 'a', kind: 'system', title: 'Hello today', body: 'fresh', createdAt: todayIso, readAt: null },
        { id: 'b', kind: 'recurring-due', title: 'From last week', body: 'old', createdAt: earlierIso, readAt: null, link: '/expenses' },
      ]);
    });
    expect(screen.getByText('Hello today')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();

    fireEvent.click(screen.getByText('From last week'));
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('b'));
    expect(mockPush).toHaveBeenCalledWith('/expenses');
  });

  it('marks all read via the dropdown footer button', async () => {
    render(<DropdownNotification />);
    await waitFor(() => expect(mockUnreadWatchers.length).toBeGreaterThan(0));
    await act(async () => { mockUnreadWatchers[0](3); });
    const btn = await screen.findByRole('button', { name: /mark all read/i });
    fireEvent.click(btn);
    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalled());
  });
});

describe('quiet hours', () => {
  const prefsAt = (start: string, end: string): NotificationPreferences['quietHours'] => ({
    enabled: true, startHHmm: start, endHHmm: end,
  });

  it('matches a wrap-around overnight window', () => {
    const overnight = prefsAt('22:00', '07:00');
    expect(isWithinQuietHours(overnight, new Date(2026, 0, 1, 23, 30))).toBe(true);
    expect(isWithinQuietHours(overnight, new Date(2026, 0, 1, 6, 30))).toBe(true);
    expect(isWithinQuietHours(overnight, new Date(2026, 0, 1, 8, 0))).toBe(false);
  });

  it('matches a same-day window', () => {
    const lunch = prefsAt('12:00', '13:30');
    expect(isWithinQuietHours(lunch, new Date(2026, 0, 1, 12, 30))).toBe(true);
    expect(isWithinQuietHours(lunch, new Date(2026, 0, 1, 14, 0))).toBe(false);
  });

  it('returns false when disabled', () => {
    expect(isWithinQuietHours({ enabled: false, startHHmm: '00:00', endHHmm: '23:59' })).toBe(false);
  });
});

describe('channel helpers', () => {
  it('treats undefined as in-app enabled (sensible default)', () => {
    expect(isInAppEnabled(undefined)).toBe(true);
    expect(isInAppEnabled('in-app')).toBe(true);
    expect(isInAppEnabled('both')).toBe(true);
    expect(isInAppEnabled('email')).toBe(false);
    expect(isInAppEnabled('off')).toBe(false);
  });
});

describe('tax deadline helpers', () => {
  it('returns the FY containing the date (July onwards rolls over)', () => {
    expect(currentFinancialYear(new Date(2026, 5, 30))).toBe('2025-2026'); // June
    expect(currentFinancialYear(new Date(2026, 6, 1))).toBe('2026-2027'); // July
  });

  it('counts days down to 30 June', () => {
    expect(daysUntilEofy(new Date(2026, 5, 29, 12, 0))).toBeGreaterThanOrEqual(1);
    expect(daysUntilEofy(new Date(2026, 5, 30, 23, 0))).toBe(1);
  });

  it('counts days down to 31 October for lodgement', () => {
    expect(daysUntilLodgement(new Date(2026, 9, 30, 12))).toBeGreaterThanOrEqual(1);
    expect(daysUntilLodgement(new Date(2026, 10, 1))).toBe(0);
  });
});
