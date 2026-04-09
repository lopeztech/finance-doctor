import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore';
import { getAuthUserId } from '@/lib/auth-helpers';
import type { FamilyMember } from '@/lib/types';

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const snapshot = await db
    .collection('users').doc(userId)
    .collection('family-members')
    .orderBy('name')
    .get();

  const members: FamilyMember[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyMember));
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const ref = db.collection('users').doc(userId).collection('family-members').doc();
  const member: FamilyMember = { id: ref.id, name: body.name, salary: body.salary };
  await ref.set(member);
  return NextResponse.json(member, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...data } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  await db.collection('users').doc(userId).collection('family-members').doc(id).update(data);
  return NextResponse.json({ id, ...data });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  await db.collection('users').doc(userId).collection('family-members').doc(id).delete();
  return NextResponse.json({ ok: true });
}
