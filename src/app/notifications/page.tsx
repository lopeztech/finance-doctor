'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import {
  watchRecentNotifications,
  markRead,
  markAllRead,
} from '@/lib/notifications-repo';
import { KIND_META, type Notification, type NotificationKind } from '@/lib/notification-types';

const PAGE_LIMIT = 200;

function formatStamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function dayKey(iso: string): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });
}

const FILTER_ALL = 'all' as const;
type FilterKind = typeof FILTER_ALL | NotificationKind;

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterKind>(FILTER_ALL);
  const [showRead, setShowRead] = useState(true);

  useEffect(() => {
    const off = watchRecentNotifications(PAGE_LIMIT, setItems);
    return () => off();
  }, []);

  const filtered = items.filter(n => {
    if (filter !== FILTER_ALL && n.kind !== filter) return false;
    if (!showRead && n.readAt) return false;
    return true;
  });

  const grouped = new Map<string, Notification[]>();
  for (const n of filtered) {
    const k = dayKey(n.createdAt);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(n);
  }

  const handleClick = async (n: Notification, e: React.MouseEvent) => {
    if (!n.readAt) {
      try { await markRead(n.id); } catch { /* swallow */ }
    }
    if (n.link) {
      e.preventDefault();
      router.push(n.link);
    }
  };

  const unreadCount = items.filter(n => !n.readAt).length;
  const kinds = Object.keys(KIND_META) as NotificationKind[];

  return (
    <>
      <h1 className="page-header">Notifications</h1>

      <Panel>
        <PanelHeader noButton>
          <span>All Notifications</span>
        </PanelHeader>
        <PanelBody>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <button
              type="button"
              className={`btn btn-sm ${filter === FILTER_ALL ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilter(FILTER_ALL)}
            >
              All ({items.length})
            </button>
            {kinds.map(k => {
              const count = items.filter(n => n.kind === k).length;
              if (count === 0) return null;
              const meta = KIND_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter(k)}
                >
                  <i className={`fa ${meta.icon} me-1`}></i>
                  {meta.label} ({count})
                </button>
              );
            })}
            <div className="ms-auto d-flex gap-2">
              <div className="form-check form-switch d-flex align-items-center gap-2 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="show-read"
                  checked={showRead}
                  onChange={e => setShowRead(e.target.checked)}
                />
                <label className="form-check-label small mb-0" htmlFor="show-read">Show read</label>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => markAllRead().catch(() => {})}
                >
                  Mark all read
                </button>
              )}
              <Link href="/settings" className="btn btn-sm btn-outline-secondary">
                <i className="fa fa-cog me-1"></i>Preferences
              </Link>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa fa-check-circle fa-3x mb-3 d-block text-success"></i>
              <p className="mb-0">You&apos;re all caught up.</p>
            </div>
          ) : (
            [...grouped.entries()].map(([day, dayItems]) => (
              <div key={day} className="mb-3">
                <div className="text-uppercase small text-muted mb-2">{day}</div>
                <div className="list-group">
                  {dayItems.map(n => {
                    const meta = KIND_META[n.kind];
                    return (
                      <a
                        key={n.id}
                        href={n.link || '#'}
                        onClick={(e) => handleClick(n, e)}
                        className={`list-group-item list-group-item-action d-flex align-items-start gap-3 ${n.readAt ? '' : 'bg-light'}`}
                      >
                        <span className={`fa-stack ${n.readAt ? 'text-muted' : 'text-primary'}`} style={{ fontSize: '0.6em' }}>
                          <i className="fa fa-circle fa-stack-2x"></i>
                          <i className={`fa ${meta?.icon || 'fa-bell'} fa-stack-1x text-white`}></i>
                        </span>
                        <span className="flex-grow-1">
                          <div className={`d-flex justify-content-between align-items-baseline ${n.readAt ? '' : 'fw-bold'}`}>
                            <span>{n.title}</span>
                            <small className="text-muted ms-2">{formatStamp(n.createdAt)}</small>
                          </div>
                          <div className="small text-muted">{n.body}</div>
                          {meta && <small className="text-muted">{meta.label}</small>}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
