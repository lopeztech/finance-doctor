'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import { listInvestments } from '@/lib/investments-repo';
import { listLiabilities } from '@/lib/liabilities-repo';
import { listNetWorthHistory } from '@/lib/networth-history-repo';
import { computeNetWorth, deltaVs } from '@/lib/networth-calc';
import { formatCurrency } from '@/lib/format';
import { usePreferences } from '@/lib/use-preferences';
import { monthKey } from '@/lib/budgets-calc';
import type { Liability, NetWorthSnapshot } from '@/lib/networth-types';
import type { Investment } from '@/lib/types';

export default function NetWorthWidget() {
  const { prefs } = usePreferences();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([listInvestments(), listLiabilities(), listNetWorthHistory()])
      .then(([inv, liab, hist]) => { setInvestments(inv); setLiabilities(liab); setHistory(hist); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  // Render only when there's something meaningful to show.
  if (investments.length === 0 && liabilities.length === 0) return null;

  const summary = computeNetWorth(investments, liabilities);
  const month = monthKey(new Date());
  const [y, m] = month.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const lastMonth = history.find(h => h.id === prevKey);
  const monthDelta = deltaVs(summary.netWorth, lastMonth?.netWorth);
  const arrowClass = monthDelta.delta > 0 ? 'text-success' : monthDelta.delta < 0 ? 'text-danger' : 'text-muted';
  const arrow = monthDelta.delta > 0 ? '▲' : monthDelta.delta < 0 ? '▼' : '–';

  return (
    <Panel className="mb-3">
      <PanelHeader noButton>
        <div className="d-flex align-items-center">
          <i className="fa fa-scale-balanced me-2"></i>Net worth
          <Link href="/net-worth" className="ms-auto small text-decoration-none">View detail</Link>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="row align-items-center">
          <div className="col-md-5">
            <div className="display-6 fw-bold">{formatCurrency(summary.netWorth, prefs)}</div>
            {lastMonth ? (
              <small className={arrowClass}>
                {arrow} {formatCurrency(monthDelta.delta, prefs)} ({monthDelta.pct.toFixed(1)}%) since {prevKey}
              </small>
            ) : (
              <small className="text-muted">Save a snapshot on the Net Worth page to track the trend.</small>
            )}
          </div>
          <div className="col-md-7">
            <div className="row text-center">
              <div className="col-6">
                <div className="text-muted small">Assets</div>
                <div className="h6 mb-0 text-success">{formatCurrency(summary.totalAssets, prefs)}</div>
              </div>
              <div className="col-6">
                <div className="text-muted small">Liabilities</div>
                <div className="h6 mb-0 text-danger">{formatCurrency(summary.totalLiabilities, prefs)}</div>
              </div>
            </div>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
