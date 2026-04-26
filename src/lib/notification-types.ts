export type NotificationKind =
  | 'tax-deadline'
  | 'budget-alert'
  | 'recurring-due'
  | 'price-alert'
  | 'goal-milestone'
  | 'system';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  createdAt: string; // ISO 8601
  readAt: string | null;
}

export type NotificationChannel = 'in-app' | 'email' | 'both' | 'off';

export interface QuietHours {
  enabled: boolean;
  startHHmm: string; // 'HH:mm' 24h
  endHHmm: string;
}

export type DigestFrequency = 'off' | 'weekly' | 'monthly' | 'quarterly';

export interface NotificationPreferences {
  perKind: Partial<Record<NotificationKind, NotificationChannel>>;
  quietHours: QuietHours;
  /** How often the scheduled email digest fires for this user. */
  digestFrequency?: DigestFrequency;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  perKind: {
    'tax-deadline': 'in-app',
    'budget-alert': 'in-app',
    'recurring-due': 'in-app',
    'price-alert': 'in-app',
    'goal-milestone': 'in-app',
    'system': 'in-app',
  },
  quietHours: { enabled: false, startHHmm: '22:00', endHHmm: '07:00' },
  digestFrequency: 'monthly',
};

export const DIGEST_FREQUENCY_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: 'off', label: 'Off — never email me' },
  { value: 'weekly', label: 'Weekly (Monday morning)' },
  { value: 'monthly', label: 'Monthly (1st of the month)' },
  { value: 'quarterly', label: 'Quarterly (1st of Jan / Apr / Jul / Oct)' },
];

export const KIND_META: Record<NotificationKind, { label: string; icon: string; description: string }> = {
  'tax-deadline': {
    label: 'Tax deadlines',
    icon: 'fa-calendar-day',
    description: 'EOFY countdown and ATO lodgement reminders.',
  },
  'budget-alert': {
    label: 'Budget alerts',
    icon: 'fa-gauge-high',
    description: 'When a category is approaching or has exceeded its limit.',
  },
  'recurring-due': {
    label: 'Recurring expenses',
    icon: 'fa-repeat',
    description: 'When recurring expense occurrences are generated.',
  },
  'price-alert': {
    label: 'Price alerts',
    icon: 'fa-chart-line',
    description: 'Significant moves on your tracked holdings.',
  },
  'goal-milestone': {
    label: 'Savings goals',
    icon: 'fa-bullseye',
    description: 'When a goal hits a milestone or completes.',
  },
  'system': {
    label: 'System',
    icon: 'fa-bell',
    description: 'App updates, tips, and admin messages.',
  },
};

export const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'in-app', label: 'In-app only' },
  { value: 'email', label: 'Email only' },
  { value: 'both', label: 'In-app and email' },
  { value: 'off', label: 'Off' },
];

export function isInAppEnabled(channel: NotificationChannel | undefined): boolean {
  if (!channel) return true;
  return channel === 'in-app' || channel === 'both';
}

/** True if `now` falls within the [startHHmm, endHHmm) window — wrap supported. */
export function isWithinQuietHours(prefs: QuietHours, now: Date = new Date()): boolean {
  if (!prefs.enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = parseHHmm(prefs.startHHmm);
  const end = parseHHmm(prefs.endHHmm);
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map(n => parseInt(n, 10) || 0);
  return h * 60 + m;
}
