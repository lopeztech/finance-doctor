import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/firestore';
import { getGeminiModel } from '@/lib/gemini';
import type { Expense, Investment, FamilyMember } from '@/lib/types';

const SYSTEM_PROMPT = `You are "Dr Finance", an Australian tax and investment advisor.
Given a snapshot of a user's financial data, generate exactly 3 short, actionable tips.

Rules:
- Each tip must be specific to the user's actual data — never generic
- Reference real dollar amounts, categories, or holdings from their data
- Cover a mix: at least one tax tip, one investment tip, and one strategic/planning tip
- Australian financial context: ATO rules, CGT, super, Medicare Levy
- Each tip: one sentence, max 120 characters. Be punchy and direct.
- Return ONLY a JSON array of 3 objects: [{"icon": "fa-xxx", "tip": "...", "type": "tax|investment|strategy"}]
- icon must be a valid FontAwesome 6 class (e.g. fa-lightbulb, fa-triangle-exclamation, fa-piggy-bank, fa-chart-line, fa-shield, fa-calendar)
- Do NOT wrap in markdown code fences, return raw JSON only`;

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check cache first (tips refresh once per day)
    const db = getDb();
    const cacheRef = db.collection('users').doc(userId).collection('advice-chats').doc('dashboard-tips');
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data();
      const cachedDate = data?.generatedAt?.split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      if (cachedDate === today && data?.tips?.length) {
        return NextResponse.json({ tips: data.tips, cached: true });
      }
    }

    // Fetch all user data in parallel
    const [expSnap, invSnap, memberSnap] = await Promise.all([
      db.collection('users').doc(userId).collection('expenses').where('financialYear', '==', '2025-2026').get(),
      db.collection('users').doc(userId).collection('investments').get(),
      db.collection('users').doc(userId).collection('family-members').get(),
    ]);

    const expenses: Expense[] = expSnap.docs.map(d => d.data() as Expense);
    const investments: Investment[] = invSnap.docs.map(d => d.data() as Investment);
    const familyMembers: FamilyMember[] = memberSnap.docs.map(d => d.data() as FamilyMember);

    if (expenses.length === 0 && investments.length === 0) {
      return NextResponse.json({ tips: [] });
    }

    // Build context snapshot
    const totalDeductions = expenses.reduce((s, e) => s + e.amount, 0);
    const categories = [...new Set(expenses.map(e => e.category))];
    const allCategories = ['Work from Home', 'Vehicle & Travel', 'Clothing & Laundry', 'Self-Education', 'Tools & Equipment', 'Professional Memberships', 'Phone & Internet', 'Donations', 'Investment Expenses', 'Other Deductions'];
    const missingCategories = allCategories.filter(c => !categories.includes(c));

    const totalPortfolio = investments.reduce((s, i) => s + i.currentValue, 0);
    const totalGain = investments.reduce((s, i) => s + (i.currentValue - i.costBasis), 0);
    const allocationByType: Record<string, number> = {};
    investments.forEach(i => { allocationByType[i.type] = (allocationByType[i.type] || 0) + i.currentValue; });
    const unownedCount = investments.filter(i => !i.owner).length;

    const now = new Date();
    const eofy = new Date(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(), 5, 30);
    const daysToEofy = Math.ceil((eofy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const prompt = `Financial snapshot for tips generation:

Tax (FY 2025-2026):
- Total deductions: $${totalDeductions.toLocaleString()} across ${categories.length}/10 categories
- Categories claimed: ${categories.join(', ') || 'none'}
- Missing categories: ${missingCategories.join(', ') || 'none'}
- Days until EOFY: ${daysToEofy}

Investments:
- Portfolio value: $${totalPortfolio.toLocaleString()}, unrealised gain: $${totalGain.toLocaleString()}
- Allocation: ${Object.entries(allocationByType).map(([t, v]) => `${t}: ${((v / totalPortfolio) * 100).toFixed(0)}%`).join(', ') || 'none'}
- Holdings: ${investments.length}, unassigned ownership: ${unownedCount}
- Has superannuation: ${allocationByType['Superannuation'] ? 'yes' : 'no'}

Family members: ${familyMembers.length > 0 ? familyMembers.map(m => `${m.name} ($${m.salary.toLocaleString()})`).join(', ') : 'none added'}

Generate 3 tips as JSON.`;

    const model = await getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    });

    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    // Strip markdown fences if present
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const tips = JSON.parse(cleaned);

    // Cache for the day
    await cacheRef.set({
      tips,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ tips });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Dashboard tips error:', message);
    return NextResponse.json({ tips: [], error: message }, { status: 500 });
  }
}
