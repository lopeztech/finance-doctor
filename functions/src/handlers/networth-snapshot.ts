import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getDb } from '../lib/firestore';

interface InvestmentDoc {
  type?: string;
  owner?: string;
  currentValue?: number;
}

interface LiabilityDoc {
  kind?: string;
  owner?: string;
  currentBalance?: number;
}

const JOINT_KEY = '__joint';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Monthly cron: snapshots each user's current net-worth roll-up to
 * users/{email}/networth-history/{YYYY-MM}. Runs at 03:00 on the 1st.
 *
 * The on-page "Save snapshot" button writes the same shape on demand —
 * this cron is the safety net for users who don't open the app each month.
 */
export const networthSnapshot = onSchedule(
  {
    schedule: '0 3 1 * *',
    timeZone: 'Australia/Sydney',
    region: 'australia-southeast1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getDb();
    const month = monthKey(new Date());
    let written = 0;

    const users = await db.collection('users').listDocuments();
    for (const userRef of users) {
      const [invSnap, liabSnap] = await Promise.all([
        userRef.collection('investments').get(),
        userRef.collection('liabilities').get(),
      ]);
      if (invSnap.empty && liabSnap.empty) continue;

      const assetsByClass: Record<string, number> = {};
      const liabilitiesByKind: Record<string, number> = {};
      const netWorthByMember: Record<string, number> = {};
      let totalAssets = 0;
      let totalLiabilities = 0;
      let superValue = 0;

      for (const d of invSnap.docs) {
        const inv = d.data() as InvestmentDoc;
        const value = typeof inv.currentValue === 'number' ? inv.currentValue : 0;
        if (inv.type === 'Superannuation') superValue += value;
        const cls = inv.type || 'Other';
        assetsByClass[cls] = (assetsByClass[cls] || 0) + value;
        totalAssets += value;
        const ownerKey = inv.owner || JOINT_KEY;
        netWorthByMember[ownerKey] = (netWorthByMember[ownerKey] || 0) + value;
      }

      for (const d of liabSnap.docs) {
        const liab = d.data() as LiabilityDoc;
        const balance = typeof liab.currentBalance === 'number' ? liab.currentBalance : 0;
        totalLiabilities += balance;
        const kind = liab.kind || 'other';
        liabilitiesByKind[kind] = (liabilitiesByKind[kind] || 0) + balance;
        const ownerKey = liab.owner || JOINT_KEY;
        netWorthByMember[ownerKey] = (netWorthByMember[ownerKey] || 0) - balance;
      }

      const snap = {
        id: month,
        capturedAt: new Date().toISOString(),
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        assetsByClass,
        liabilitiesByKind,
        netWorthByMember,
        superValue,
      };
      await userRef.collection('networth-history').doc(month).set(snap, { merge: true });
      written += 1;
    }

    logger.info('networthSnapshot wrote', { written, month });
  },
);
