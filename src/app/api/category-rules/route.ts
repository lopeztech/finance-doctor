import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore';
import { getAuthUserId } from '@/lib/auth-helpers';

export interface CategoryRule {
  id: string;
  pattern: string;
  taxCategory?: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
}

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const snapshot = await db.collection('users').doc(userId).collection('category-rules').get();
  const rules: CategoryRule[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryRule));
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { pattern, taxCategory, spendingCategory, spendingSubCategory, nonDeductible } = body;
  if (!pattern) return NextResponse.json({ error: 'Pattern required' }, { status: 400 });

  const db = getDb();
  // Check if rule already exists for this pattern
  const existing = await db.collection('users').doc(userId).collection('category-rules')
    .where('pattern', '==', pattern.toLowerCase()).get();

  if (!existing.empty) {
    // Update existing rule
    const doc = existing.docs[0];
    const updates: Record<string, string | boolean> = {};
    if (taxCategory) updates.taxCategory = taxCategory;
    if (spendingCategory) updates.spendingCategory = spendingCategory;
    if (spendingSubCategory !== undefined) updates.spendingSubCategory = spendingSubCategory;
    if (nonDeductible !== undefined) updates.nonDeductible = nonDeductible;
    await doc.ref.update(updates);
    return NextResponse.json({ id: doc.id, ...doc.data(), ...updates });
  }

  const ref = db.collection('users').doc(userId).collection('category-rules').doc();
  const rule: CategoryRule = {
    id: ref.id,
    pattern: pattern.toLowerCase(),
    ...(taxCategory ? { taxCategory } : {}),
    ...(spendingCategory ? { spendingCategory } : {}),
    ...(spendingSubCategory ? { spendingSubCategory } : {}),
    ...(nonDeductible !== undefined ? { nonDeductible } : {}),
  };
  await ref.set(rule);
  return NextResponse.json(rule, { status: 201 });
}
