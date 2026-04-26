export const SPENDING_ICONS: Record<string, string> = {
  'Bakery': 'fa-bread-slice',
  'Cafe': 'fa-mug-hot',
  'Car': 'fa-car-side',
  'Dining & Takeaway': 'fa-utensils',
  'Education': 'fa-graduation-cap',
  'Entertainment': 'fa-film',
  'Financial & Banking': 'fa-university',
  'Gifts & Donations': 'fa-gift',
  'Groceries': 'fa-cart-shopping',
  'Healthcare': 'fa-heart-pulse',
  'Home & Garden': 'fa-house',
  'Insurance': 'fa-shield',
  'Kids Entertainment': 'fa-child',
  'Personal Care': 'fa-spa',
  'Personal Project': 'fa-lightbulb',
  'Shopping': 'fa-bag-shopping',
  'Subscriptions': 'fa-repeat',
  'Transport': 'fa-car',
  'Travel & Holidays': 'fa-plane',
  'Utilities & Bills': 'fa-bolt',
  'Other': 'fa-ellipsis',
};

export const SPENDING_COLORS: Record<string, string> = {
  'Bakery': '#d4a373',
  'Cafe': '#8d6e63',
  'Car': '#455a64',
  'Dining & Takeaway': '#fd7e14',
  'Education': '#0dcaf0',
  'Entertainment': '#6f42c1',
  'Financial & Banking': '#607d8b',
  'Gifts & Donations': '#e91e63',
  'Groceries': '#20c997',
  'Healthcare': '#dc3545',
  'Home & Garden': '#795548',
  'Insurance': '#198754',
  'Kids Entertainment': '#4caf50',
  'Personal Care': '#ff69b4',
  'Personal Project': '#ff9800',
  'Shopping': '#e83e8c',
  'Subscriptions': '#6610f2',
  'Transport': '#0d6efd',
  'Travel & Holidays': '#17a2b8',
  'Utilities & Bills': '#ffc107',
  'Other': '#6c757d',
};

export const DEFAULT_SPENDING_CATEGORIES = Object.keys(SPENDING_ICONS);

export function spendingIcon(category: string | undefined | null): string {
  if (!category) return 'fa-ellipsis';
  return SPENDING_ICONS[category] || 'fa-ellipsis';
}

export function spendingColor(category: string | undefined | null): string {
  if (!category) return '#6c757d';
  return SPENDING_COLORS[category] || '#6c757d';
}
