// backend/scripts/seedCuratedRecipes.ts
//
// Pushes the hand-written recipes in frontend/constants/recipes.ts into the
// Supabase `recipes` table so curated and imported recipes live in one
// place. That file stays the source of truth for these — edit
// there, then re-run this script.
//
//   npm run db:seed   (from backend/)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { RECIPES } from '../../frontend/constants/recipes';
import { recipeToRow } from '../../frontend/lib/recipeRow';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = RECIPES.map(recipeToRow);

  const { error } = await supabase.from('recipes').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`Seeded ${rows.length} curated recipes.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
