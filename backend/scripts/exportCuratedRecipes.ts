// backend/scripts/exportCuratedRecipes.ts
//
// Writes frontend/constants/recipes.ts to JSON so the Python cleaner can
// read it. Used by `npm run db:tag-curated`; you don't run it on its own.
//
//   npx tsx scripts/exportCuratedRecipes.ts database/curated_recipes.json

import { existsSync, writeFileSync } from 'fs';
import path from 'path';

const recipesFile = path.resolve(__dirname, '..', '..', 'frontend', 'constants', 'recipes.ts');

if (!existsSync(recipesFile)) {
  console.error(
    `\nCan't find the curated recipes at:\n  ${recipesFile}\n\n` +
      'The backend folder must sit next to the app\'s frontend folder in the same repo:\n' +
      '  <repo>/backend   (this folder)\n' +
      '  <repo>/frontend/constants/recipes.ts\n\n' +
      'If you unzipped a BiteWise update into a new folder, copy its backend/ and frontend/\n' +
      'files into your real repo instead, then run this from <repo>/backend.\n',
  );
  process.exit(1);
}

// Loaded after the check so a wrong folder gives the message above, not a stack trace.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RECIPES } = require(recipesFile) as typeof import('../../frontend/constants/recipes');

const out = process.argv[2] ?? 'database/curated_recipes.json';
writeFileSync(out, JSON.stringify(RECIPES, null, 2));
console.log(`Exported ${RECIPES.length} curated recipes to ${out}`);
