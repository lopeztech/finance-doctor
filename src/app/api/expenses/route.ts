import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore';
import { getAuthUserId } from '@/lib/auth-helpers';
import type { Expense } from '@/lib/types';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fy = req.nextUrl.searchParams.get('fy') || '2025-2026';
  const db = getDb();
  const snapshot = await db
    .collection('users').doc(userId)
    .collection('expenses')
    .where('financialYear', '==', fy)
    .orderBy('date', 'desc')
    .get();

  const expenses: Expense[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const ref = db.collection('users').doc(userId).collection('expenses').doc();
  const expense: Expense = {
    id: ref.id,
    date: body.date,
    description: body.description,
    amount: body.amount,
    category: body.category,
    financialYear: body.financialYear,
    ...(body.owner ? { owner: body.owner } : {}),
  };
  await ref.set(expense);
  return NextResponse.json(expense, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...data } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  await db.collection('users').doc(userId).collection('expenses').doc(id).update(data);
  return NextResponse.json({ id, ...data });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  await db.collection('users').doc(userId).collection('expenses').doc(id).delete();
  return NextResponse.json({ ok: true });
}
