export const AVAILABLE_UNITS = [
  'Items',
  'Cups',
  'Oz',
  'Servings',
  'Lbs',
  'Bags',
];

export const QUICK_ADDS = [
  { id: 'q1', icon: '🥛', name: 'Milk', category: 'Dairy / Refrigerated', unit: 'Cartons' },
  { id: 'q2', icon: '🥚', name: 'Eggs', category: 'Dairy / Refrigerated', unit: 'Items' },
  { id: 'q3', icon: '🧈', name: 'Butter', category: 'Dairy / Refrigerated', unit: 'Items' },
  { id: 'q4', icon: '🥖', name: 'Flour', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { id: 'q5', icon: '🍬', name: 'Sugar', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { id: 'q6', icon: '🍓', name: 'Strawberries', category: 'Produce', unit: 'Bags' },
];

export const SUGGESTION_LIBRARY = [
  // Dairy / Refrigerated
  { icon: '🥛', name: 'Milk', category: 'Dairy / Refrigerated', unit: 'Cartons' },
  { icon: '🥚', name: 'Eggs', category: 'Dairy / Refrigerated', unit: 'Items' },
  { icon: '🧈', name: 'Butter', category: 'Dairy / Refrigerated', unit: 'Items' },
  { icon: '🍦', name: 'Sour Cream', category: 'Dairy / Refrigerated', unit: 'Items' },
  { icon: '🥪', name: 'Mayonnaise', category: 'Dairy / Refrigerated', unit: 'Items' },
  { icon: '🧀', name: 'Cheddar Cheese', category: 'Dairy / Refrigerated', unit: 'Bags' },
  
  // Pantry / Dry Goods
  { icon: '🥖', name: 'Flour', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { icon: '🍬', name: 'Sugar', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { icon: '🍫', name: 'Chocolate Cake Mix', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { icon: '🍪', name: 'Chocolate Chips', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { icon: '🥛', name: 'Buttermilk', category: 'Pantry / Dry Goods', unit: 'Cartons' },
  { icon: '🍝', name: 'Pasta', category: 'Pantry / Dry Goods', unit: 'Bags' },
  { icon: '🫙', name: 'Olive Oil', category: 'Pantry / Dry Goods', unit: 'Items' },
  
  // Proteins
  { icon: '🥩', name: 'Ground Beef', category: 'Proteins', unit: 'Lbs' },
  { icon: '🍗', name: 'Chicken Breast', category: 'Proteins', unit: 'Lbs' },
  
  // Produce
  { icon: '🍓', name: 'Strawberries', category: 'Produce', unit: 'Bags' },
  { icon: '🧅', name: 'Onions', category: 'Produce', unit: 'Items' },
  { icon: '🧄', name: 'Garlic', category: 'Produce', unit: 'Items' },
];

export const INITIAL_CATEGORIES = [
  {
    id: 'c4',
    emoji: '🥦',
    category_name: 'Produce',
    count: 0,
    items: [],
  },
  {
    id: 'c1',
    emoji: '🥛',
    category_name: 'Dairy / Refrigerated',
    count: 3,
    items: [
      { id: 'i1', name: 'Eggs', quantity: 12, unit: 'Items' },
      { id: 'i2', name: 'Sour Cream', quantity: 1, unit: 'Items' },
      { id: 'i3', name: 'Butter', quantity: 4, unit: 'Items' },
    ],
  },
  {
    id: 'c3',
    emoji: '🥩',
    category_name: 'Proteins',
    count: 0,
    items: [],
  },
  {
    id: 'c2',
    emoji: '🥖',
    category_name: 'Pantry / Dry Goods',
    count: 2,
    items: [
      { id: 'i4', name: 'Chocolate Cake Mix', quantity: 2, unit: 'Bags' },
      { id: 'i5', name: 'Chocolate Chips', quantity: 1, unit: 'Bags' },
    ],
  },
];

export const MOCK_MEALS = [
  {
    id: 'm1',
    title: 'Creamy Garlic Chicken Pasta',
    matchPercentage: 80,
    usedIngredientsCount: 8,
    extraIngredientsRemaining: 4,
    tags: [
      { name: 'Chicken Breast', icon: '🍗' },
      { name: 'Pasta', icon: '🌾' },
      { name: 'Garlic', icon: '🧄' },
      { name: 'Cheddar Cheese', icon: '🧀' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'm2',
    title: 'Chicken & Veggie Rice Bowl',
    matchPercentage: 75,
    usedIngredientsCount: 8,
    extraIngredientsRemaining: 3,
    tags: [
      { name: 'Chicken Breast', icon: '🍗' },
      { name: 'Rice', icon: '🌾' },
      { name: 'Tomatoes', icon: '🍅' },
      { name: 'Garlic', icon: '🧄' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'm3',
    title: 'Cheesy Chicken Casserole',
    matchPercentage: 70,
    usedIngredientsCount: 7,
    extraIngredientsRemaining: 3,
    tags: [
      { name: 'Chicken Breast', icon: '🍗' },
      { name: 'Cheddar Cheese', icon: '🧀' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'm4',
    title: 'Beef & Broccoli Stir Fry',
    matchPercentage: 65,
    usedIngredientsCount: 6,
    extraIngredientsRemaining: 3,
    tags: [
      { name: 'Ground Beef', icon: '🍗' },
      { name: 'Broccoli', icon: '🥦' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' },
      { name: 'Onions', icon: '🧅' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=300&auto=format&fit=crop'
  }
];