import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  type CollectionReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface CategoryRule {
  id: string;
  pattern: string;
  taxCategory?: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
}

export interface CategoryRuleInput {
  pattern: string;
  taxCategory?: string;
  spendingCategory?: string;
  spendingSubCategory?: string;
  nonDeductible?: boolean;
}

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function categoryRulesCollection(): CollectionReference {
  if (!db) throw new Error('Firestore is not initialised');
  return collection(db, 'users', getUserKey(), 'category-rules');
}

export async function listCategoryRules(): Promise<CategoryRule[]> {
  const snap = await getDocs(categoryRulesCollection());
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryRule));
}

export async function upsertCategoryRule(input: CategoryRuleInput): Promise<CategoryRule> {
  const { pattern, taxCategory, spendingCategory, spendingSubCategory, nonDeductible } = input;
  if (!pattern) throw new Error('Pattern required');
  const col = categoryRulesCollection();
  const normalized = pattern.toLowerCase();
  const existing = await getDocs(query(col, where('pattern', '==', normalized)));

  if (!existing.empty) {
    const docSnap = existing.docs[0];
    const updates: Record<string, string | boolean> = {};
    if (taxCategory) updates.taxCategory = taxCategory;
    if (spendingCategory) updates.spendingCategory = spendingCategory;
    if (spendingSubCategory !== undefined) updates.spendingSubCategory = spendingSubCategory;
    if (nonDeductible !== undefined) updates.nonDeductible = nonDeductible;
    if (Object.keys(updates).length > 0) await updateDoc(docSnap.ref, updates);
    return { id: docSnap.id, ...(docSnap.data() as Omit<CategoryRule, 'id'>), ...updates };
  }

  const ref = doc(col);
  const rule: CategoryRule = {
    id: ref.id,
    pattern: normalized,
    ...(taxCategory ? { taxCategory } : {}),
    ...(spendingCategory ? { spendingCategory } : {}),
    ...(spendingSubCategory ? { spendingSubCategory } : {}),
    ...(nonDeductible !== undefined ? { nonDeductible } : {}),
  };
  await setDoc(ref, rule);
  return rule;
}
