'use client';

import DataManagement from '@/components/data-management';
import ExpensesExclusionSettings from '@/components/expenses-exclusion-settings';
import CategoryReference from '@/components/category-reference';
import CashflowReference from '@/components/cashflow-reference';
import NotificationPreferencesPanel from '@/components/notification-preferences';
import PreferencesPanel from '@/components/preferences-panel';
import { useAuthUser } from '@/lib/use-auth-user';
import { useGuestMode } from '@/lib/use-guest-mode';

export default function SettingsPage() {
  const { user } = useAuthUser();
  const { guest } = useGuestMode();

  const name = guest ? 'Guest' : (user?.displayName || user?.email || 'Your account');
  const email = guest ? 'Demo mode' : (user?.email || '');
  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <main className="report">
      {/* ── Report head ── */}
      <div className="report-head">
        <div className="lead">
          <div className="eyebrow">Account · Settings</div>
          <h1>Settings</h1>
          <p className="dek">Preferences, privacy, notifications, and your data — all in one place.</p>
        </div>
        <div className="meta">
          <div className="big">{name}</div>
          {email && <>{email}<br /></>}
          {today}
        </div>
      </div>

      {/* ── 01 Display & Defaults ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">01</span>
          <h2>Display &amp; Defaults</h2>
          <div className="agg">How figures, dates, and pages appear</div>
        </div>
        <PreferencesPanel />
      </section>

      {/* ── 02 Expenses ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">02</span>
          <h2>Expenses</h2>
          <div className="agg">Exclusions and category mappings</div>
        </div>
        <ExpensesExclusionSettings />
        <div style={{ marginTop: 24 }}>
          <CategoryReference />
        </div>
      </section>

      {/* ── 03 Cashflow ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">03</span>
          <h2>Cashflow</h2>
          <div className="agg">Income sources and member configuration</div>
        </div>
        <CashflowReference />
      </section>

      {/* ── 04 Notifications ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">04</span>
          <h2>Notifications</h2>
          <div className="agg">How each alert reaches you</div>
        </div>
        <NotificationPreferencesPanel />
      </section>

      {/* ── 05 Data ── */}
      <section className="section">
        <div className="sec-head">
          <span className="no">05</span>
          <h2>Your Data</h2>
          <div className="agg">Export, import, or reset</div>
        </div>
        <DataManagement />
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--rule-2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-3)' }}>
          <i className="fa fa-clock"></i>
          <span>
            Last build · {process.env.NEXT_PUBLIC_BUILD_TIME
              ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString('en-AU')
              : 'Development mode'}
          </span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="report-footer">
        <span className="rf-brand"><i className="fa fa-user-doctor"></i> Finance Doctor</span>
        <span>Settings · {today}</span>
        <span className="rf-end">General information only — not financial advice.</span>
      </footer>
    </main>
  );
}
