import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as guest from './guest-store';

export type SpendingCategoryType = 'essential' | 'committed' | 'discretionary';

export interface CategorySettings {
  types: Record<string, SpendingCategoryType>;
  excluded: string[];
}

export const DEFAULT_CATEGORY_TYPES: Record<string, SpendingCategoryType> = {
  'Bakery': 'discretionary',
  'Cafe': 'discretionary',
  'Car': 'essential',
  'Dining & Takeaway': 'discretionary',
  'Education': 'essential',
  'Entertainment': 'discretionary',
  'Financial & Banking': 'committed',
  'Gifts & Donations': 'discretionary',
  'Groceries': 'essential',
  'Healthcare': 'essential',
  'Home & Garden': 'discretionary',
  'Insurance': 'essential',
  'Kids Entertainment': 'discretionary',
  'Personal Care': 'discretionary',
  'Personal Project': 'discretionary',
  'Shopping': 'discretionary',
  'Subscriptions': 'committed',
  'Transport': 'essential',
  'Travel & Holidays': 'discretionary',
  'Utilities & Bills': 'essential',
  'Other': 'discretionary',
};

const EMPTY: CategorySettings = { types: {}, excluded: [] };

function getUserKey(): string {
  const email = auth?.currentUser?.email;
  if (!email) throw new Error('Not authenticated');
  return email;
}

function settingsRef() {
  if (!db) throw new Error('Firestore is not initialised');
  return doc(db, 'users', getUserKey(), 'meta', 'category-settings');
}

export async function getCategorySettings(): Promise<CategorySettings> {
  if (guest.isGuest()) return guest.getCategorySettings();
  try {
    const snap = await getDoc(settingsRef());
    if (!snap.exists()) return { ...EMPTY };
    const data = snap.data() as Partial<CategorySettings>;
    return {
      types: data.types || {},
      excluded: Array.isArray(data.excluded) ? data.excluded : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveCategorySettings(settings: CategorySettings): Promise<void> {
  if (guest.isGuest()) { guest.setCategorySettings(settings); return; }
  await setDoc(settingsRef(), settings);
}

export async function setCategoryType(category: string, type: SpendingCategoryType | null): Promise<CategorySettings> {
  const current = await getCategorySettings();
  const nextTypes = { ...current.types };
  if (type === null) delete nextTypes[category];
  else nextTypes[category] = type;
  const next: CategorySettings = { ...current, types: nextTypes };
  await saveCategorySettings(next);
  return next;
}

export async function setExcludedCategories(excluded: string[]): Promise<CategorySettings> {
  const current = await getCategorySettings();
  const next: CategorySettings = { ...current, excluded: [...new Set(excluded)] };
  await saveCategorySettings(next);
  return next;
}

export function resolveType(category: string, settings: CategorySettings): SpendingCategoryType | undefined {
  return settings.types[category] ?? DEFAULT_CATEGORY_TYPES[category];
}
