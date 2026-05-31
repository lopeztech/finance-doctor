'use client';

import { useAuthUser } from '@/lib/use-auth-user';
import { useGuestMode } from '@/lib/use-guest-mode';
import { currentFinancialYear } from '@/lib/tax-deadline';

export default function SidebarHousehold() {
  const { user } = useAuthUser();
  const { guest } = useGuestMode();
  const fy = currentFinancialYear().replace('-', '–');

  const name = guest
    ? 'Guest Household'
    : (user?.displayName || user?.email?.split('@')[0] || 'My Household');

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';

  return (
    <div className="sidebar-household">
      <span className="sidebar-household-avatar">{initials}</span>
      <div className="sidebar-household-info">
        <div className="sidebar-household-name">{name}</div>
        <div className="sidebar-household-meta">FY {fy}</div>
      </div>
    </div>
  );
}
