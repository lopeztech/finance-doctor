'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/lib/notification-preferences-repo';
import {
  CHANNEL_OPTIONS,
  DEFAULT_PREFERENCES,
  KIND_META,
  type NotificationChannel,
  type NotificationKind,
  type NotificationPreferences,
} from '@/lib/notification-types';

const KINDS = Object.keys(KIND_META) as NotificationKind[];

export default function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => setPrefs({ ...DEFAULT_PREFERENCES }))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next: NotificationPreferences) => {
    setPrefs(next);
    setSaving(true);
    try {
      await saveNotificationPreferences(next);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const updateChannel = (kind: NotificationKind, channel: NotificationChannel) => {
    persist({ ...prefs, perKind: { ...prefs.perKind, [kind]: channel } });
  };

  const updateQuietHours = (patch: Partial<NotificationPreferences['quietHours']>) => {
    persist({ ...prefs, quietHours: { ...prefs.quietHours, ...patch } });
  };

  return (
    <Panel className="mt-4">
      <PanelHeader noButton>
        <i className="fa fa-bell me-2"></i>Notifications
      </PanelHeader>
      <PanelBody>
        {loading ? (
          <div className="text-muted small"><i className="fa fa-spinner fa-spin me-1"></i>Loading…</div>
        ) : (
          <>
            <p className="text-muted small mb-3">
              Choose how each kind of alert reaches you. Email delivery is wired up as features
              (budgets, EOFY checklist) ship — for now everything routes through the in-app bell.
            </p>

            <div className="table-responsive mb-4">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Notification</th>
                    <th>Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {KINDS.map(kind => {
                    const meta = KIND_META[kind];
                    const channel = prefs.perKind[kind] ?? 'in-app';
                    return (
                      <tr key={kind}>
                        <td>
                          <div className="d-flex align-items-start gap-2">
                            <i className={`fa ${meta.icon} text-muted mt-1`}></i>
                            <div>
                              <div>{meta.label}</div>
                              <small className="text-muted">{meta.description}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={channel}
                            onChange={(e) => updateChannel(kind, e.target.value as NotificationChannel)}
                            disabled={saving}
                          >
                            {CHANNEL_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h6 className="mb-2">Quiet hours</h6>
            <p className="text-muted small mb-3">
              Push notifications are suppressed during this window. In-app entries still appear so
              you can catch up the next morning.
            </p>
            <div className="row g-2 align-items-center">
              <div className="col-auto">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="quiet-hours-enabled"
                    checked={prefs.quietHours.enabled}
                    onChange={e => updateQuietHours({ enabled: e.target.checked })}
                    disabled={saving}
                  />
                  <label className="form-check-label" htmlFor="quiet-hours-enabled">Enabled</label>
                </div>
              </div>
              <div className="col-auto">
                <label className="form-label small mb-0 me-1">From</label>
                <input
                  type="time"
                  className="form-control form-control-sm d-inline-block"
                  style={{ width: 110 }}
                  value={prefs.quietHours.startHHmm}
                  onChange={e => updateQuietHours({ startHHmm: e.target.value || '22:00' })}
                  disabled={saving || !prefs.quietHours.enabled}
                />
              </div>
              <div className="col-auto">
                <label className="form-label small mb-0 me-1">To</label>
                <input
                  type="time"
                  className="form-control form-control-sm d-inline-block"
                  style={{ width: 110 }}
                  value={prefs.quietHours.endHHmm}
                  onChange={e => updateQuietHours({ endHHmm: e.target.value || '07:00' })}
                  disabled={saving || !prefs.quietHours.enabled}
                />
              </div>
              <div className="col-auto ms-auto">
                {saving && <small className="text-muted"><i className="fa fa-spinner fa-spin me-1"></i>Saving</small>}
                {!saving && savedAt && <small className="text-success"><i className="fa fa-check me-1"></i>Saved</small>}
              </div>
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
