// context/AppContext.tsx
// One source of truth for pantry, preferences, favorites, and history.
//
// NEW: everything now persists to AsyncStorage, and the context tracks
// whether the user has finished onboarding. Without persistence the
// setup flow would re-run on every app launch, which defeats the point
// of a "set up once" flow.
//
// Persistence pattern:
//   - On mount, hydrate all slices from storage, then flip `hydrated`.
//   - After hydration, each slice saves itself whenever it changes.
//   - The root layout keeps the splash screen up until `hydrated` is
//     true, so the app never flashes default state before loading.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  PantryItem,
  PantryCategoryId,
  UserPreferences,
  SavedRecipe,
  QuizRun,
} from '../types';
import { getIconForItem, guessCategory } from '../constants/Itemicons';

// ============================================
// DEFAULTS & STORAGE KEYS
// ============================================

const DEFAULT_PREFERENCES: UserPreferences = {
  name: '',
  dietary: [],
  avoidAllergens: [],
  maxCookMinutes: null,
  preferredDifficulty: null,
  householdSize: 2,
  favoriteTags: [],
};

const KEYS = {
  pantry: '@bitewise/pantry',
  preferences: '@bitewise/preferences',
  favorites: '@bitewise/favorites',
  history: '@bitewise/history',
  onboarded: '@bitewise/onboarded',
} as const;

// ============================================
// CONTEXT SHAPE
// ============================================

interface AppContextValue {
  /** True once persisted state has been loaded from disk. */
  hydrated: boolean;

  // Onboarding
  hasOnboarded: boolean;
  completeOnboarding: () => void;
  /** Dev/testing helper: wipes the flag so setup runs again. */
  resetOnboarding: () => void;

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
  const [hydrated, setHydrated] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [favorites, setFavorites] = useState<SavedRecipe[]>([]);
  const [history, setHistory] = useState<QuizRun[]>([]);

  // ---------- Hydrate once on mount ----------

  useEffect(() => {
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet(Object.values(KEYS));
        const data = Object.fromEntries(entries);

        if (data[KEYS.pantry]) setPantry(JSON.parse(data[KEYS.pantry]!));
        if (data[KEYS.preferences]) {
          // Spread over defaults so newly added fields (like favoriteTags)
          // exist even for users who saved preferences before the field did.
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(data[KEYS.preferences]!) });
        }
        if (data[KEYS.favorites]) setFavorites(JSON.parse(data[KEYS.favorites]!));
        if (data[KEYS.history]) setHistory(JSON.parse(data[KEYS.history]!));
        if (data[KEYS.onboarded]) setHasOnboarded(JSON.parse(data[KEYS.onboarded]!) === true);
      } catch (e) {
        // Corrupt or missing storage: fall back to defaults rather than crash.
        console.warn('BiteWise: failed to load saved data', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // ---------- Save slices after hydration ----------

  const persist = useCallback(
    (key: string, value: unknown) => {
      if (!hydrated) return; // never overwrite disk with defaults mid-load
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(e =>
        console.warn('BiteWise: failed to save', key, e)
      );
    },
    [hydrated]
  );

  useEffect(() => persist(KEYS.pantry, pantry), [pantry, persist]);
  useEffect(() => persist(KEYS.preferences, preferences), [preferences, persist]);
  useEffect(() => persist(KEYS.favorites, favorites), [favorites, persist]);
  useEffect(() => persist(KEYS.history, history), [history, persist]);
  useEffect(() => persist(KEYS.onboarded, hasOnboarded), [hasOnboarded, persist]);

  // ---------- Onboarding ----------

  const completeOnboarding = useCallback(() => setHasOnboarded(true), []);
  const resetOnboarding = useCallback(() => setHasOnboarded(false), []);

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
    hydrated,
    hasOnboarded,
    completeOnboarding,
    resetOnboarding,
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
