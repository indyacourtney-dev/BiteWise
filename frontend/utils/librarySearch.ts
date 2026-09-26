// utils/librarySearch.ts — type-ahead over the pantry library (constants/pantryData.ts).
// Matches names and other names ("scallions" finds Green Onions); names that
// start with the typed text come first.

import { SUGGESTION_LIBRARY, type PantryLibraryItem } from '../constants/pantryData';
import { foodWords } from './customFoods';
import { libraryItemIsAlcohol } from './alcohol';

/** allowAlcohol: wine, beer and spirits are only suggested to people 21+. */
export function searchLibrary(query: string, limit = 6, allowAlcohol = false): PantryLibraryItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = foodWords(q).join(' ');
  const scored: { item: PantryLibraryItem; rank: number }[] = [];
  for (const item of SUGGESTION_LIBRARY) {
    if (!allowAlcohol && libraryItemIsAlcohol(item)) continue;
    const name = item.name.toLowerCase();
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (name.split(' ').some(w => w.startsWith(q))) rank = 1;
    else if (name.includes(q) || (words && foodWords(name).join(' ').includes(words))) rank = 2;
    else if (item.aliases?.some(a => a.includes(q))) rank = 3;
    if (rank >= 0) scored.push({ item, rank });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.item.name.length - b.item.name.length)
    .slice(0, limit)
    .map(s => s.item);
}
