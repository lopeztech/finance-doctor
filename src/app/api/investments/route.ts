import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore';
import { getAuthUserId } from '@/lib/auth-helpers';
import type { Investment } from '@/lib/types';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const snapshot = await db
    .collection('users').doc(userId)
    .collection('investments')
    .orderBy('name')
    .get();

  const investments: Investment[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment));
  return NextResponse.json(investments);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const ref = db.collection('users').doc(userId).collection('investments').doc();
  const investment: Investment = { id: ref.id, ...body };
  await ref.set(investment);
  return NextResponse.json(investment, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  const ref = db.collection('users').doc(userId).collection('investments').doc(id);
  await ref.update(data);
  return NextResponse.json({ id, ...data });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  await db.collection('users').doc(userId).collection('investments').doc(id).delete();
  return NextResponse.json({ ok: true });
}
