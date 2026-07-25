// constants/pantryData.ts
//
// Dummy data + shared color tokens for BiteWise.
// Replace COLORS values with your real palette whenever it's ready —
// the key names below are what the This or That / pantry components
// already expect (darkNavy, success, etc.), so keep the keys the same
// even if you swap the hex values.

export const COLORS = {
  darkNavy: '#1F2A37',
  success: '#2ECC71',
  warning: '#E8B33D',
  danger: '#D64545',
  background: '#F7F5F1',
  card: '#FFFFFF',
  border: '#E5E1D8',
  textPrimary: '#1F2A37',
  textSecondary: '#6B7280',
  accent: '#4C8C6E',
};

// --- Dummy pantry data ---
// Shape matches the GET /api/pantry response from the team's schema
// notes, so this can stand in for the real API while the backend
// isn't wired up yet.

export interface PantryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

export interface PantryCategory {
  category_name: string;
  items: PantryItem[];
}

export interface QuickAddItem {
  id: number;
  name: string;
  category: string;
}

export const PANTRY_CATEGORIES: PantryCategory[] = [
  {
    category_name: 'Produce',
    items: [
      { id: 101, name: 'Apples', quantity: 4, unit: 'items' },
      { id: 102, name: 'Lettuce', quantity: 1, unit: 'head' },
      { id: 103, name: 'Tomatoes', quantity: 3, unit: 'items' },
      { id: 104, name: 'Garlic', quantity: 1, unit: 'bulb' },
    ],
  },
  {
    category_name: 'Meat & Seafood',
    items: [
      { id: 201, name: 'Chicken Breast', quantity: 1.5, unit: 'lbs' },
      { id: 202, name: 'Ground Beef', quantity: 1, unit: 'lb' },
    ],
  },
  {
    category_name: 'Dairy & Eggs',
    items: [
      { id: 301, name: 'Eggs', quantity: 12, unit: 'items' },
      { id: 302, name: 'Milk', quantity: 1, unit: 'gallon' },
      { id: 303, name: 'Cheddar Cheese', quantity: 8, unit: 'oz' },
    ],
  },
  {
    category_name: 'Pantry',
    items: [
      { id: 401, name: 'Rice', quantity: 2, unit: 'lbs' },
      { id: 402, name: 'Pasta', quantity: 1, unit: 'box' },
      { id: 403, name: 'Crackers', quantity: 1, unit: 'box' },
      { id: 404, name: 'Mustard', quantity: 1, unit: 'bottle' },
    ],
  },
];

export const QUICK_ADDS: QuickAddItem[] = [
  { id: 501, name: 'Eggs', category: 'Dairy & Eggs' },
  { id: 502, name: 'Milk', category: 'Dairy & Eggs' },
  { id: 503, name: 'Garlic', category: 'Produce' },
  { id: 504, name: 'Rice', category: 'Pantry' },
];
