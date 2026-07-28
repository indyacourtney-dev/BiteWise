// context/AppContext.tsx
// One source of truth for pantry, preferences, favorites, and history.
// Without this, the pantry screen and the quiz screen can't see each
// other's data — which is what blocks real "cook from my pantry" mode.

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import type {
  PantryItem,
  PantryCategoryId,
  UserPreferences,
  SavedRecipe,
  QuizRun,
} from '../types';
import { getIconForItem, guessCategory } from '../constants/Itemicons';
//frontend/constants/itemIcons.ts

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_PREFERENCES: UserPreferences = {
  name: '',
  dietary: [],
  avoidAllergens: [],
  maxCookMinutes: null,
  preferredDifficulty: null,
  householdSize: 2,
};

// ============================================
// CONTEXT SHAPE
// ============================================

interface AppContextValue {
  // Pantry
  pantry: PantryItem[];
  addPantryItem: (name: string, category?: PantryCategoryId, unit?: string) => void;
  updatePantryQuantity: (id: string, delta: number) => void;
  removePantryItem: (id: string) => void;
  clearPantry: () => void;

  // Preferences
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;

  // Favorites
  favorites: SavedRecipe[];
  toggleFavorite: (recipeId: string) => void;
  isFavorite: (recipeId: string) => boolean;

  // History
  history: QuizRun[];
  recordQuizRun: (run: Omit<QuizRun, 'id' | 'completedAt'>) => void;
  clearHistory: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export function AppProvider({ children }: { children: ReactNode }) {
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [favorites, setFavorites] = useState<SavedRecipe[]>([]);
  const [history, setHistory] = useState<QuizRun[]>([]);

  // ---------- Pantry ----------

  const addPantryItem = useCallback(
    (name: string, category?: PantryCategoryId, unit = 'qty') => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const resolvedCategory = category ?? guessCategory(trimmed);

      setPantry(prev => {
        // Bump quantity instead of creating a duplicate row
        const existing = prev.find(
          i => i.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) {
          return prev.map(i =>
            i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }

        const item: PantryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: trimmed,
          quantity: 1,
          unit,
          category: resolvedCategory,
          icon: getIconForItem(trimmed, resolvedCategory),
          addedAt: Date.now(),
        };
        return [...prev, item];
      });
    },
    []
  );

  const updatePantryQuantity = useCallback((id: string, delta: number) => {
    setPantry(prev =>
      prev.map(i =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
      )
    );
  }, []);

  const removePantryItem = useCallback((id: string) => {
    setPantry(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearPantry = useCallback(() => setPantry([]), []);

  // ---------- Preferences ----------

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...patch }));
  }, []);

  // ---------- Favorites ----------

  const toggleFavorite = useCallback((recipeId: string) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.recipeId === recipeId);
      if (exists) return prev.filter(f => f.recipeId !== recipeId);
      return [...prev, { recipeId, savedAt: Date.now() }];
    });
  }, []);

  const isFavorite = useCallback(
    (recipeId: string) => favorites.some(f => f.recipeId === recipeId),
    [favorites]
  );

  // ---------- History ----------

  const recordQuizRun = useCallback(
    (run: Omit<QuizRun, 'id' | 'completedAt'>) => {
      setHistory(prev => [
        {
          ...run,
          id: `${Date.now()}`,
          completedAt: Date.now(),
        },
        ...prev,
      ].slice(0, 25)); // keep the last 25 runs
    },
    []
  );

  const clearHistory = useCallback(() => setHistory([]), []);

  const value: AppContextValue = {
    pantry,
    addPantryItem,
    updatePantryQuantity,
    removePantryItem,
    clearPantry,
    preferences,
    updatePreferences,
    favorites,
    toggleFavorite,
    isFavorite,
    history,
    recordQuizRun,
    clearHistory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside <AppProvider>. Wrap your root layout with it.');
  }
  return ctx;
}
