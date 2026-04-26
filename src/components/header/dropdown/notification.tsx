'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  watchUnreadCount,
  watchRecentNotifications,
  markRead,
  markAllRead,
} from '@/lib/notifications-repo';
import { KIND_META, type Notification } from '@/lib/notification-types';

const RECENT_LIMIT = 10;

function relativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString('en-AU');
}

function isToday(iso: string): boolean {
  if (!iso) return false;
  return new Date(iso).toLocaleDateString('en-AU') === new Date().toLocaleDateString('en-AU');
}

export default function DropdownNotification() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<Notification[]>([]);

  useEffect(() => {
    const offCount = watchUnreadCount(setUnread);
    const offList = watchRecentNotifications(RECENT_LIMIT, setRecent);
    return () => { offCount(); offList(); };
  }, []);

  const handleClick = async (n: Notification, e: React.MouseEvent) => {
    if (!n.readAt) {
      try { await markRead(n.id); } catch { /* swallow */ }
    }
    if (n.link) {
      e.preventDefault();
      router.push(n.link);
    }
  };

  const handleMarkAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { await markAllRead(); } catch { /* swallow */ }
  };

  const todayItems = recent.filter(n => isToday(n.createdAt));
  const earlierItems = recent.filter(n => !isToday(n.createdAt));
  const badgeText = unread === 0 ? null : unread > 9 ? '9+' : String(unread);

  return (
    <div className="navbar-item dropdown">
      <a
        href="#"
        data-bs-toggle="dropdown"
        className="navbar-link dropdown-toggle icon"
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      >
        <i className="fa fa-bell"></i>
        {badgeText && <span className="badge">{badgeText}</span>}
      </a>
      <div className="dropdown-menu media-list dropdown-menu-end" style={{ minWidth: 320 }}>
        <div className="dropdown-header d-flex justify-content-between align-items-center">
          <span>NOTIFICATIONS{unread > 0 ? ` (${unread})` : ''}</span>
          {unread > 0 && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={handleMarkAll}
            >
              Mark all read
            </button>
          )}
        </div>

        {recent.length === 0 && (
          <div className="text-center py-4 px-3 text-muted">
            <i className="fa fa-check-circle fa-2x mb-2 d-block text-success"></i>
            You&apos;re all caught up
          </div>
        )}

        {todayItems.length > 0 && (
          <>
            <div className="dropdown-header text-uppercase small text-muted">Today</div>
            {todayItems.map(n => (
              <NotificationItem key={n.id} n={n} onClick={handleClick} />
            ))}
          </>
        )}

        {earlierItems.length > 0 && (
          <>
            <div className="dropdown-header text-uppercase small text-muted">Earlier</div>
            {earlierItems.map(n => (
              <NotificationItem key={n.id} n={n} onClick={handleClick} />
            ))}
          </>
        )}

        <div className="dropdown-footer text-center">
          <Link href="/notifications" className="text-decoration-none">View all</Link>
        </div>
      </div>
    </div>
  );
}

interface ItemProps {
  n: Notification;
  onClick: (n: Notification, e: React.MouseEvent) => void;
}

function NotificationItem({ n, onClick }: ItemProps) {
  const meta = KIND_META[n.kind];
  const icon = meta?.icon || 'fa-bell';
  return (
    <a
      href={n.link || '#'}
      className={`dropdown-item d-flex align-items-start gap-2 py-2 ${n.readAt ? '' : 'fw-bold'}`}
      onClick={(e) => onClick(n, e)}
    >
      <span className={`media-icon ${n.readAt ? 'text-muted' : 'text-primary'}`} style={{ flex: '0 0 auto' }}>
        <i className={`fa ${icon}`}></i>
      </span>
      <span className="flex-grow-1" style={{ whiteSpace: 'normal' }}>
        <span className="d-block">{n.title}</span>
        <small className="d-block text-muted">{n.body}</small>
        <small className="d-block text-muted">{relativeTime(n.createdAt)}</small>
      </span>
    </a>
  );
}
