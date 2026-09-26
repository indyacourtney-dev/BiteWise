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
  useRef,
  ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { fetchMyBirthDate, saveMyBirthDate } from '../lib/ageApi';
import { isOfDrinkingAge } from '../utils/age';
import { addExposures, type Exposure } from '../utils/variety';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from './AuthContext';
import type {
  AppSettings,
  GroceryItem,
  GrocerySource,
  PlanSlot,
  PlannedMeal,
  MealType,
  PantryItem,
  PantryCategoryId,
  UserPreferences,
  SavedRecipe,
  QuizRun,
} from '../types';
import { getIconForItem, guessCategory } from '../constants/Itemicons';
import { findPantryLibraryItem } from '../constants/pantryData';
import { aisleFor, stockStatus } from '../utils/pantryStatus';
import { changedRows, mergeRows, pullKitchen, pushKitchen, syncAvailable } from '../lib/kitchenSync';
import { configured } from '../lib/supabase';
import { addFavorite, removeFavorite, syncFavorites } from '../lib/favoritesApi';
import { ensureProfile } from '../lib/communityApi';
import { getMealTypeForNow } from '../utils/meals';

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
  dislikedTags: [],
  spiceTolerance: null,
  cuisines: [],
  customAllergies: [],
  customAvoid: [],
  customLoves: [],
};

export const DEFAULT_SETTINGS: AppSettings = {
  textScale: 1,
  boldText: false,
  reduceMotion: 'system',
  haptics: true,
  speechRate: 1,
};

// Storage keys are scoped PER ACCOUNT. Before this, keys were device-wide,
// so the second account created on a phone skipped onboarding and inherited
// the first account's pantry and preferences.
const keysFor = (userId: string) =>
  ({
    pantry: `@bitewise/${userId}/pantry`,
    preferences: `@bitewise/${userId}/preferences`,
    favorites: `@bitewise/${userId}/favorites`,
    history: `@bitewise/${userId}/history`,
    onboarded: `@bitewise/${userId}/onboarded`,
    settings: `@bitewise/${userId}/settings`,
    grocery: `@bitewise/${userId}/grocery`,
    /** Recipes shown in recent This or That games, so the next game shows different ones. */
    recentGame: `@bitewise/${userId}/recentGame`,
    /** Recipes shown or chosen as picks (utils/variety.ts), newest first. */
    exposure: `@bitewise/${userId}/exposure`,
    /** Locked birthday ('YYYY-MM-DD'). The account copy (lib/ageApi.ts) wins. */
    birthDate: `@bitewise/${userId}/birthDate`,
    mealPlan: `@bitewise/${userId}/mealPlan`,
    /** Sync bookkeeping: deletions not yet uploaded, and when we last synced. */
    sync: `@bitewise/${userId}/sync`,
  }) as const;

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
  /** Adds an item, or adds `quantity` more of one you already have. */
  addPantryItem: (name: string, category?: PantryCategoryId, unit?: string, quantity?: number) => void;
  /** +1 / -1. Stops at 0 ("out"); the item stays so it can go on the grocery list. */
  updatePantryQuantity: (id: string, delta: number) => void;
  /** Change unit, running-low level (null = automatic), or mark as just bought. */
  updatePantryItem: (id: string, patch: { unit?: string; lowAt?: number | null; restocked?: boolean }) => void;
  removePantryItem: (id: string) => void;
  clearPantry: () => void;

  // This or That variety: recipes shown in the last few games (newest first).
  recentGameRecipes: string[];
  rememberGameRecipes: (ids: string[]) => void;

  // Variety: what the app suggested recently, so suggestions don't repeat.
  recipeExposure: Exposure[];
  noteRecipesShown: (ids: string[], chosen?: boolean) => void;

  // Plan my week
  mealPlan: PlannedMeal[];
  /** Puts a recipe in a day's breakfast / lunch / dinner (replacing what was there). */
  planMeal: (
    date: string,
    slot: PlanSlot,
    recipe: { id: string; name: string; emoji: string; prepMinutes?: number; cookMinutes?: number },
  ) => void;
  /** Adds several at once (Fill my week). */
  planMeals: (entries: Omit<PlannedMeal, 'id' | 'addedAt'>[]) => void;
  unplanMeal: (id: string) => void;
  toggleMealCooked: (id: string) => void;

  // Grocery list
  grocery: GroceryItem[];
  /** Returns false if it was already on the list (it's un-checked instead). */
  addGroceryItem: (
    name: string,
    opts?: { quantity?: number; unit?: string; source?: GrocerySource; note?: string; category?: PantryCategoryId },
  ) => boolean;
  toggleGroceryItem: (id: string) => void;
  updateGroceryQuantity: (id: string, delta: number) => void;
  removeGroceryItem: (id: string) => void;
  /** Adds every running-low or out item that isn't on the list yet. Returns how many. */
  addLowStockToGrocery: () => number;
  /** Checked items go into the pantry (freshness restarts) and leave the list. Returns how many. */
  moveCheckedToPantry: () => number;
  clearCheckedGrocery: () => void;

  // Which meal the user is deciding on (breakfast / brunch / lunch /
  // dinner / dessert). Starts from the clock each launch; every decider
  // screen reads it.
  mealType: MealType;
  setMealType: (meal: MealType) => void;

  // App settings (accessibility etc.)
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Preferences
  /** Includes allowAlcohol, worked out from the locked birthday. */
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;

  // Age safeguard
  /** 'YYYY-MM-DD', locked once saved. null = not given yet. */
  birthDate: string | null;
  /** true once we've checked the account for a saved birthday (or couldn't). */
  birthDateChecked: boolean;
  /** Saves the birthday once. Fails if one is already saved. */
  setBirthDate: (iso: string) => Promise<{ ok: boolean; error?: string }>;

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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [hydrated, setHydrated] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [birthDate, setBirthDateState] = useState<string | null>(null);
  const [birthDateChecked, setBirthDateChecked] = useState(false);
  const [favorites, setFavorites] = useState<SavedRecipe[]>([]);
  const [history, setHistory] = useState<QuizRun[]>([]);
  const [mealType, setMealType] = useState<MealType>(() => getMealTypeForNow());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [recentGameRecipes, setRecentGameRecipes] = useState<string[]>([]);
  const [recipeExposure, setRecipeExposure] = useState<Exposure[]>([]);
  const [mealPlan, setMealPlan] = useState<PlannedMeal[]>([]);
  const favoritesRef = useRef<SavedRecipe[]>([]);
  const pantryRef = useRef<PantryItem[]>([]);
  const groceryRef = useRef<GroceryItem[]>([]);
  useEffect(() => {
    pantryRef.current = pantry;
  }, [pantry]);
  useEffect(() => {
    groceryRef.current = grocery;
  }, [grocery]);

  // Sync bookkeeping (see lib/kitchenSync.ts). Kept in refs + one storage key.
  const syncMeta = useRef<{
    lastSyncAt: number | null;
    pantryTombstones: string[];
    groceryTombstones: string[];
  }>({ lastSyncAt: null, pantryTombstones: [], groceryTombstones: [] });
  const syncedPantry = useRef(new Map<string, number>());
  const syncedGrocery = useRef(new Map<string, number>());
  const [syncTick, setSyncTick] = useState(0); // bumps when tombstones change
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  // ---------- Hydrate per account ----------
  // Runs on mount AND whenever the logged-in user changes: reset to
  // defaults, then load that account's slices from its own keys.

  useEffect(() => {
    setHydrated(false);
    setPantry([]);
    setPreferences(DEFAULT_PREFERENCES);
    setFavorites([]);
    setHistory([]);
    setHasOnboarded(false);
    setSettings(DEFAULT_SETTINGS);
    setGrocery([]);
    setRecentGameRecipes([]);
    setRecipeExposure([]);
    setMealPlan([]);
    setBirthDateState(null);
    setBirthDateChecked(false);
    syncMeta.current = { lastSyncAt: null, pantryTombstones: [], groceryTombstones: [] };
    syncedPantry.current = new Map();
    syncedGrocery.current = new Map();

    if (!userId) return; // logged out: stay on defaults, gate handles routing

    const KEYS = keysFor(userId);
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet(Object.values(KEYS));
        const data = Object.fromEntries(entries);

        if (data[KEYS.pantry]) {
          // Items saved before sync existed have no updatedAt: use addedAt.
          const saved: PantryItem[] = JSON.parse(data[KEYS.pantry]!);
          setPantry(saved.map(i => ({ ...i, updatedAt: i.updatedAt ?? i.addedAt })));
        }
        if (data[KEYS.grocery]) setGrocery(JSON.parse(data[KEYS.grocery]!));
        if (data[KEYS.recentGame]) setRecentGameRecipes(JSON.parse(data[KEYS.recentGame]!));
        if (data[KEYS.exposure]) setRecipeExposure(JSON.parse(data[KEYS.exposure]!));
        if (data[KEYS.birthDate]) setBirthDateState(JSON.parse(data[KEYS.birthDate]!));
        if (data[KEYS.mealPlan]) {
          // Drop days more than two weeks old so the plan doesn't grow forever.
          const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
          const saved: PlannedMeal[] = JSON.parse(data[KEYS.mealPlan]!);
          setMealPlan(saved.filter(m => m.date >= cutoff));
        }
        if (data[KEYS.sync]) syncMeta.current = { ...syncMeta.current, ...JSON.parse(data[KEYS.sync]!) };
        if (data[KEYS.preferences]) {
          // Spread over defaults so newly added fields (like dislikedTags)
          // exist even for users who saved preferences before the field did.
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(data[KEYS.preferences]!) });
        }
        if (data[KEYS.favorites]) setFavorites(JSON.parse(data[KEYS.favorites]!));
        if (data[KEYS.history]) setHistory(JSON.parse(data[KEYS.history]!));
        if (data[KEYS.onboarded]) setHasOnboarded(JSON.parse(data[KEYS.onboarded]!) === true);
        if (data[KEYS.settings]) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data[KEYS.settings]!) });
      } catch (e) {
        // Corrupt or missing storage: fall back to defaults rather than crash.
        console.warn('BiteWise: failed to load saved data', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, [userId]);

  // ---------- Save slices after hydration ----------

  const persist = useCallback(
    (key: keyof ReturnType<typeof keysFor>, value: unknown) => {
      if (!hydrated || !userId) return; // never write defaults mid-load or logged out
      AsyncStorage.setItem(keysFor(userId)[key], JSON.stringify(value)).catch(e =>
        console.warn('BiteWise: failed to save', key, e)
      );
    },
    [hydrated, userId]
  );

  useEffect(() => persist('pantry', pantry), [pantry, persist]);
  useEffect(() => persist('preferences', preferences), [preferences, persist]);
  useEffect(() => persist('favorites', favorites), [favorites, persist]);
  useEffect(() => persist('history', history), [history, persist]);
  useEffect(() => persist('onboarded', hasOnboarded), [hasOnboarded, persist]);
  useEffect(() => persist('settings', settings), [settings, persist]);
  useEffect(() => persist('grocery', grocery), [grocery, persist]);
  useEffect(() => persist('recentGame', recentGameRecipes), [recentGameRecipes, persist]);
  useEffect(() => persist('exposure', recipeExposure), [recipeExposure, persist]);
  useEffect(() => persist('mealPlan', mealPlan), [mealPlan, persist]);
  useEffect(() => {
    if (birthDate) persist('birthDate', birthDate);
  }, [birthDate, persist]);
  useEffect(() => persist('sync', syncMeta.current), [syncTick, persist]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  // ---------- Supabase sync (favorites + chat profile) ----------
  // Once per sign-in, after local data is loaded: upload hearts saved on
  // this phone, pull hearts saved on other devices, and make sure the user
  // has a profile for chat. Failures (offline, no keys) are non-fatal —
  // the app keeps working from local storage.

  useEffect(() => {
    if (!hydrated || !userId || !configured) return;
    let cancelled = false;
    ensureProfile().catch(e => console.warn('BiteWise: profile setup failed', e));
    syncFavorites(favoritesRef.current)
      .then(merged => {
        if (!cancelled) setFavorites(merged);
      })
      .catch(e => console.warn('BiteWise: favorites sync failed', e));
    return () => {
      cancelled = true;
    };
  }, [hydrated, userId]);

  // ---------- Pantry & grocery sync (Supabase) ----------
  // Pull on sign-in and when the app returns to the foreground; push
  // changes about a second after the last edit. Everything keeps working
  // from local storage if the tables aren't there or the phone is offline.

  const pulling = useRef(false);
  const pull = useCallback(async () => {
    if (!hydrated || !userId || !syncAvailable() || pulling.current) return;
    pulling.current = true;
    try {
      const remote = await pullKitchen();
      if (!remote) return;
      const meta = syncMeta.current;
      const mergedPantry = mergeRows(pantryRef.current, remote.pantry, {
        tombstones: new Set(meta.pantryTombstones),
        lastSyncAt: meta.lastSyncAt,
      });
      const mergedGrocery = mergeRows(groceryRef.current, remote.grocery, {
        tombstones: new Set(meta.groceryTombstones),
        lastSyncAt: meta.lastSyncAt,
      });
      // What the server has now counts as synced.
      syncedPantry.current = new Map(remote.pantry.map(r => [r.id, r.updatedAt ?? 0]));
      syncedGrocery.current = new Map(remote.grocery.map(r => [r.id, r.updatedAt ?? 0]));
      setPantry(mergedPantry);
      setGrocery(mergedGrocery);
      setSyncTick(t => t + 1); // triggers a push of anything newer here
    } catch (e) {
      console.warn('BiteWise: pantry sync (download) failed', e);
    } finally {
      pulling.current = false;
    }
  }, [hydrated, userId]);

  useEffect(() => {
    pull();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') pull();
    });
    return () => sub.remove();
  }, [pull]);

  useEffect(() => {
    if (!hydrated || !userId || !syncAvailable()) return;
    const timer = setTimeout(async () => {
      const meta = syncMeta.current;
      const pantryUpserts = changedRows(pantry, syncedPantry.current);
      const groceryUpserts = changedRows(grocery, syncedGrocery.current);
      const pantryDeletes = [...meta.pantryTombstones];
      const groceryDeletes = [...meta.groceryTombstones];
      if (!pantryUpserts.length && !groceryUpserts.length && !pantryDeletes.length && !groceryDeletes.length) return;
      try {
        const ok = await pushKitchen({ pantryUpserts, pantryDeletes, groceryUpserts, groceryDeletes });
        if (!ok) return;
        pantryUpserts.forEach(i => syncedPantry.current.set(i.id, i.updatedAt ?? 0));
        groceryUpserts.forEach(i => syncedGrocery.current.set(i.id, i.updatedAt ?? 0));
        pantryDeletes.forEach(id => syncedPantry.current.delete(id));
        groceryDeletes.forEach(id => syncedGrocery.current.delete(id));
        syncMeta.current = {
          lastSyncAt: Date.now(),
          pantryTombstones: meta.pantryTombstones.filter(id => !pantryDeletes.includes(id)),
          groceryTombstones: meta.groceryTombstones.filter(id => !groceryDeletes.includes(id)),
        };
        setSyncTick(t => t + 1);
      } catch (e) {
        console.warn('BiteWise: pantry sync (upload) failed', e);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [pantry, grocery, syncTick, hydrated, userId]);

  const tombstone = useCallback((table: 'pantry' | 'grocery', ids: string[]) => {
    if (ids.length === 0) return;
    const meta = syncMeta.current;
    syncMeta.current =
      table === 'pantry'
        ? { ...meta, pantryTombstones: [...new Set([...meta.pantryTombstones, ...ids])] }
        : { ...meta, groceryTombstones: [...new Set([...meta.groceryTombstones, ...ids])] };
    setSyncTick(t => t + 1);
  }, []);

  // ---------- Onboarding ----------

  const completeOnboarding = useCallback(() => setHasOnboarded(true), []);
  const resetOnboarding = useCallback(() => setHasOnboarded(false), []);

  // ---------- Pantry ----------

  const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const addPantryItem = useCallback(
    (name: string, category?: PantryCategoryId, unit?: string, quantity = 1) => {
      const trimmed = name.trim();
      if (!trimmed || quantity <= 0) return;

      // Known items (quick adds, suggestions, their other names) carry their
      // own section, icon and unit; anything else is guessed from the name.
      // "tomato", "Tomatoes" and "scallions" are stored under the library's
      // name ("Tomatoes", "Green Onions"), so they never become two rows.
      const known = findPantryLibraryItem(trimmed);
      const canonical = known?.name ?? trimmed;
      const resolvedCategory = category ?? known?.pantryCategory ?? guessCategory(trimmed);
      const now = Date.now();

      setPantry(prev => {
        // More of something you already have: add to it, don't duplicate.
        const existing = prev.find(i => i.name.toLowerCase() === canonical.toLowerCase());
        if (existing) {
          return prev.map(i => {
            if (i.id !== existing.id) return i;
            const qty = i.quantity + quantity;
            const wasOut = i.quantity <= 0;
            return {
              ...i,
              quantity: qty,
              // Restocking from empty starts the freshness clock again.
              stockedAt: wasOut ? now : i.stockedAt ?? i.addedAt,
              stockedQty: wasOut ? qty : Math.max(i.stockedQty ?? i.quantity, qty),
              updatedAt: now,
            };
          });
        }

        const item: PantryItem = {
          id: newId(),
          name: canonical,
          quantity,
          unit: unit ?? known?.unit ?? 'Items',
          category: resolvedCategory,
          icon: known?.icon ?? getIconForItem(trimmed, resolvedCategory),
          addedAt: now,
          stockedAt: now,
          stockedQty: quantity,
          updatedAt: now,
        };
        return [...prev, item];
      });
    },
    []
  );

  const updatePantryQuantity = useCallback((id: string, delta: number) => {
    const now = Date.now();
    setPantry(prev =>
      prev.map(i => {
        if (i.id !== id) return i;
        const qty = Math.max(0, i.quantity + delta);
        const restock = delta > 0 && i.quantity <= 0;
        return {
          ...i,
          quantity: qty,
          stockedAt: restock ? now : i.stockedAt,
          stockedQty: restock ? qty : Math.max(i.stockedQty ?? i.quantity, qty),
          updatedAt: now,
        };
      })
    );
  }, []);

  const updatePantryItem = useCallback(
    (id: string, patch: { unit?: string; lowAt?: number | null; restocked?: boolean }) => {
      const now = Date.now();
      setPantry(prev =>
        prev.map(i => {
          if (i.id !== id) return i;
          const next: PantryItem = { ...i, updatedAt: now };
          if (patch.unit) next.unit = patch.unit;
          if (patch.lowAt === null) delete next.lowAt;
          else if (typeof patch.lowAt === 'number') next.lowAt = Math.max(0, patch.lowAt);
          if (patch.restocked) {
            next.stockedAt = now;
            next.stockedQty = Math.max(1, i.quantity);
            if (i.quantity <= 0) next.quantity = 1;
          }
          return next;
        })
      );
    },
    []
  );

  const removePantryItem = useCallback(
    (id: string) => {
      setPantry(prev => prev.filter(i => i.id !== id));
      tombstone('pantry', [id]);
    },
    [tombstone]
  );

  const clearPantry = useCallback(() => {
    tombstone('pantry', pantryRef.current.map(i => i.id));
    setPantry([]);
  }, [tombstone]);

  // ---------- This or That variety ----------

  /** About three games' worth of cards; older ones can come back. */
  const rememberGameRecipes = useCallback((ids: string[]) => {
    setRecentGameRecipes(prev => [...new Set([...ids, ...prev])].slice(0, 40));
  }, []);

  // ---------- Plan my week ----------

  const planMeals = useCallback((entries: Omit<PlannedMeal, 'id' | 'addedAt'>[]) => {
    if (entries.length === 0) return;
    const now = Date.now();
    setMealPlan(prev => {
      const taken = new Set(entries.map(e => `${e.date}|${e.slot}`));
      const kept = prev.filter(m => !taken.has(`${m.date}|${m.slot}`));
      const added = entries.map((e, i) => ({ ...e, id: `${now}-${i}-${Math.random().toString(36).slice(2, 6)}`, addedAt: now }));
      return [...kept, ...added];
    });
    // Planned = chosen, so Decide for me and next week's plan suggest other things.
    setRecipeExposure(prev => addExposures(prev, entries.map(e => ({ id: e.recipeId, at: now, chosen: true }))));
  }, []);

  const planMeal = useCallback(
    (
      date: string,
      slot: PlanSlot,
      recipe: { id: string; name: string; emoji: string; prepMinutes?: number; cookMinutes?: number },
    ) =>
      planMeals([
        {
          date,
          slot,
          recipeId: recipe.id,
          name: recipe.name,
          emoji: recipe.emoji,
          minutes: (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined,
          cooked: false,
        },
      ]),
    [planMeals]
  );

  const unplanMeal = useCallback((id: string) => setMealPlan(prev => prev.filter(m => m.id !== id)), []);

  const toggleMealCooked = useCallback(
    (id: string) => setMealPlan(prev => prev.map(m => (m.id === id ? { ...m, cooked: !m.cooked } : m))),
    []
  );

  const noteRecipesShown = useCallback((ids: string[], chosen = false) => {
    if (ids.length === 0) return;
    const at = Date.now();
    setRecipeExposure(prev => addExposures(prev, ids.map(id => ({ id, at, ...(chosen ? { chosen: true } : {}) }))));
  }, []);

  // ---------- Grocery list ----------

  const addGroceryItem = useCallback(
    (
      name: string,
      opts: { quantity?: number; unit?: string; source?: GrocerySource; note?: string; category?: PantryCategoryId } = {},
    ): boolean => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const now = Date.now();
      const known = findPantryLibraryItem(trimmed);
      const canonical = (known?.name ?? trimmed).toLowerCase();
      const inPantry = pantryRef.current.find(i => i.name.toLowerCase() === canonical);
      const existing = groceryRef.current.find(g => g.name.toLowerCase() === canonical);
      if (existing) {
        if (existing.checked) {
          setGrocery(prev => prev.map(g => (g.id === existing.id ? { ...g, checked: false, updatedAt: now } : g)));
        }
        return false;
      }
      const category = opts.category ?? inPantry?.category ?? known?.pantryCategory ?? guessCategory(trimmed);
      const item: GroceryItem = {
        id: newId(),
        name: inPantry?.name ?? known?.name ?? trimmed,
        icon: inPantry?.icon ?? known?.icon ?? getIconForItem(trimmed, category),
        quantity: Math.max(1, opts.quantity ?? inPantry?.stockedQty ?? 1),
        unit: opts.unit ?? inPantry?.unit ?? known?.unit ?? 'Items',
        category,
        aisle: aisleFor(trimmed, category),
        checked: false,
        source: opts.source ?? 'manual',
        ...(opts.note ? { note: opts.note } : {}),
        addedAt: now,
        updatedAt: now,
      };
      setGrocery(prev => [...prev, item]);
      groceryRef.current = [...groceryRef.current, item]; // so a loop of adds sees each other
      return true;
    },
    []
  );

  const toggleGroceryItem = useCallback((id: string) => {
    const now = Date.now();
    setGrocery(prev => prev.map(g => (g.id === id ? { ...g, checked: !g.checked, updatedAt: now } : g)));
  }, []);

  const updateGroceryQuantity = useCallback((id: string, delta: number) => {
    const now = Date.now();
    setGrocery(prev =>
      prev.map(g => (g.id === id ? { ...g, quantity: Math.max(1, g.quantity + delta), updatedAt: now } : g))
    );
  }, []);

  const removeGroceryItem = useCallback(
    (id: string) => {
      setGrocery(prev => prev.filter(g => g.id !== id));
      tombstone('grocery', [id]);
    },
    [tombstone]
  );

  const addLowStockToGrocery = useCallback((): number => {
    let added = 0;
    for (const item of pantryRef.current) {
      if (stockStatus(item) === 'ok') continue;
      const need = Math.max(1, (item.stockedQty ?? 1) - item.quantity);
      if (addGroceryItem(item.name, { source: 'low-stock', quantity: need, unit: item.unit, category: item.category })) added++;
    }
    return added;
  }, [addGroceryItem]);

  const moveCheckedToPantry = useCallback((): number => {
    const bought = groceryRef.current.filter(g => g.checked);
    bought.forEach(g => addPantryItem(g.name, g.category, g.unit, g.quantity));
    if (bought.length) {
      const ids = new Set(bought.map(g => g.id));
      setGrocery(prev => prev.filter(g => !ids.has(g.id)));
      tombstone('grocery', [...ids]);
    }
    return bought.length;
  }, [addPantryItem, tombstone]);

  const clearCheckedGrocery = useCallback(() => {
    const ids = groceryRef.current.filter(g => g.checked).map(g => g.id);
    setGrocery(prev => prev.filter(g => !g.checked));
    tombstone('grocery', ids);
  }, [tombstone]);

  // ---------- Preferences ----------

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    // allowAlcohol comes from the birthday only; it can't be switched on here.
    const { allowAlcohol: _ignored, ...rest } = patch;
    setPreferences(prev => ({ ...prev, ...rest }));
  }, []);

  // ---------- Age safeguard ----------
  // The birthday is set once (onboarding, or the age check for accounts
  // made before this existed) and then locked: here, and on the account,
  // where the database refuses changes. The account copy always wins, so a
  // reinstall or a new phone can't reset it.

  const birthDateRef = useRef<string | null>(null);
  useEffect(() => {
    birthDateRef.current = birthDate;
  }, [birthDate]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    let cancelled = false;
    (async () => {
      const server = await fetchMyBirthDate();
      if (cancelled) return;
      if (typeof server === 'string') {
        setBirthDateState(server);
      } else if (server === null && birthDateRef.current) {
        // Saved on this phone while offline: send it up now.
        const saved = await saveMyBirthDate(birthDateRef.current);
        if (!cancelled && saved) setBirthDateState(saved);
      }
      if (!cancelled) setBirthDateChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, userId]);

  const setBirthDate = useCallback(async (iso: string) => {
    if (birthDateRef.current) {
      return { ok: false, error: "Your birthday is already saved and can't be changed." };
    }
    birthDateRef.current = iso;
    setBirthDateState(iso); // locked on this phone right away
    const saved = await saveMyBirthDate(iso);
    // If the account already had one (from another phone), that one stands.
    if (saved && saved !== iso) {
      birthDateRef.current = saved;
      setBirthDateState(saved);
    }
    return { ok: true };
  }, []);

  const effectivePreferences = React.useMemo<UserPreferences>(
    () => ({ ...preferences, allowAlcohol: isOfDrinkingAge(birthDate) }),
    [preferences, birthDate]
  );

  // ---------- Favorites ----------

  // The heart updates instantly; the database write happens in the
  // background (Task 1.6: favorites are stored per user in Supabase).
  const toggleFavorite = useCallback(
    (recipeId: string) => {
      const exists = favoritesRef.current.some(f => f.recipeId === recipeId);
      setFavorites(prev =>
        exists
          ? prev.filter(f => f.recipeId !== recipeId)
          : [{ recipeId, savedAt: Date.now() }, ...prev.filter(f => f.recipeId !== recipeId)]
      );
      if (userId && configured) {
        (exists ? removeFavorite(recipeId) : addFavorite(recipeId)).catch(e =>
          console.warn('BiteWise: could not save favorite to the database', e)
        );
      }
    },
    [userId]
  );

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
    updatePantryItem,
    removePantryItem,
    clearPantry,
    recentGameRecipes,
    rememberGameRecipes,
    recipeExposure,
    noteRecipesShown,
    mealPlan,
    planMeal,
    planMeals,
    unplanMeal,
    toggleMealCooked,
    grocery,
    addGroceryItem,
    toggleGroceryItem,
    updateGroceryQuantity,
    removeGroceryItem,
    addLowStockToGrocery,
    moveCheckedToPantry,
    clearCheckedGrocery,
    mealType,
    setMealType,
    settings,
    updateSettings,
    preferences: effectivePreferences,
    birthDate,
    birthDateChecked,
    setBirthDate,
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