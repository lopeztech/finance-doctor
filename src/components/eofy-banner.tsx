'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { activeEofyFinancialYear, daysUntilEofyEnd, daysUntilLodgement, isEofySeason } from '@/lib/eofy';

export default function EofyBanner() {
  // Compute on mount only — no need to re-render through a season change in
  // a single session.
  const [show, setShow] = useState(false);
  const [fy, setFy] = useState('');
  const [daysToEofy, setDaysToEofy] = useState(0);
  const [daysToLodge, setDaysToLodge] = useState(0);

  useEffect(() => {
    const now = new Date();
    if (!isEofySeason(now)) return;
    setShow(true);
    setFy(activeEofyFinancialYear(now));
    setDaysToEofy(daysUntilEofyEnd(activeEofyFinancialYear(now), now));
    setDaysToLodge(daysUntilLodgement(activeEofyFinancialYear(now), now));
  }, []);

  if (!show) return null;

  return (
    <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
      <i className="fa fa-calendar-day fa-lg me-3"></i>
      <div className="flex-grow-1">
        <strong>EOFY {fy} is here.</strong>{' '}
        {daysToEofy > 0
          ? <>Your FY ends in <strong>{daysToEofy} day{daysToEofy === 1 ? '' : 's'}</strong>.</>
          : <>Your FY has ended — self-lodgement closes in <strong>{daysToLodge} day{daysToLodge === 1 ? '' : 's'}</strong>.</>}
        {' '}Run through the checklist before you lodge.
      </div>
      <Link href="/eofy" className="btn btn-warning btn-sm ms-3">
        <i className="fa fa-list-check me-1"></i>Open EOFY checklist
      </Link>
    </div>
  );
}
