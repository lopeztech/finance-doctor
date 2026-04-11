import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore';
import { getAuthUserId } from '@/lib/auth-helpers';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type');
  if (!type || !['tax', 'investments', 'custom-spending-categories'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const db = getDb();
  const doc = await db.collection('users').doc(userId).collection('advice-chats').doc(type).get();

  if (!doc.exists) {
    return NextResponse.json({ history: [] });
  }

  return NextResponse.json({ history: doc.data()?.history || [] });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, history } = await req.json() as { type: string; history: ChatMessage[] };
  if (!type || !['tax', 'investments', 'custom-spending-categories'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const db = getDb();
  await db.collection('users').doc(userId).collection('advice-chats').doc(type).set({
    history,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type');
  if (!type || !['tax', 'investments', 'custom-spending-categories'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const db = getDb();
  await db.collection('users').doc(userId).collection('advice-chats').doc(type).delete();

  return NextResponse.json({ ok: true });
}
