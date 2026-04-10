import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';

function getFinancialYear(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

export async function POST() {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const snapshot = await db.collection('users').doc(userId).collection('expenses').get();

    const batch = db.batch();
    let fixed = 0;
    let cleanedOwner = 0;
    let addedFY = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const updates: Record<string, unknown> = {};

      // Backfill financialYear from date if missing
      if (!data.financialYear && data.date) {
        updates.financialYear = getFinancialYear(data.date);
        addedFY++;
      }

      // Clean up empty owner strings
      if (data.owner === '') {
        updates.owner = null;
        cleanedOwner++;
      }

      // Remove duplicate field if it was accidentally saved
      if ('duplicate' in data) {
        updates.duplicate = null;
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        fixed++;
      }
    }

    if (fixed > 0) await batch.commit();

    return NextResponse.json({
      total: snapshot.size,
      fixed,
      addedFY,
      cleanedOwner,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Migration error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
