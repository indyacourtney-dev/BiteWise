# BiteWise backend

Builds the recipe database and loads it into Supabase, and holds the database side of favorites, chat rooms and shared home recipes. The Expo app in `frontend/` reads it through `frontend/lib/recipesApi.ts` and `frontend/lib/pantryApi.ts`. Auth already runs on the same Supabase project (`frontend/lib/supabase.ts`).

```
backend/
├── database/                  Python: cleans the Kaggle CSV → SQLite
│                              (ingredient matching, allergens, diet/health tags, macros, swaps)
├── scripts/
│   ├── seedCuratedRecipes.ts  frontend/constants/recipes.ts → Supabase
│   ├── pushCleanedRecipes.ts  cleaned SQLite → Supabase
│   └── kaggle/                quiz-tag rules (tags, emoji, vibe, times, meal filter)
├── supabase/migrations/       tables, security rules, pantry functions,
│                              favorites, profiles, chat rooms, home recipes
└── data/                      put recipes_data.csv here (git-ignored)
```

## Setup (once)

You need Node 22.5+ and Python 3.10+. The Python side has no packages to install.

```bash
cd backend
npm install
cp .env.example .env        # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

Both values are in the Supabase dashboard under Project Settings → API. The service role key stays in `backend/.env` only. The app keeps using the anon key from `frontend/.env`.

Apply the migrations with the Supabase CLI, from `backend/`:

```bash
npx supabase init            # first time only: adds supabase/config.toml, keeps migrations/
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```

Or paste each file in `supabase/migrations/` into the dashboard's SQL editor, oldest first.

### Account deletion (Edge Function)

Settings → Privacy & data → *Delete account* calls a small server function, because deleting a login needs admin rights that must never be inside the app. Deploy it once, from `backend/`:

```bash
npx supabase functions deploy delete-account
```

Supabase provides its URL and service key to the function automatically; there's nothing to configure. Profile photos use the `avatars` storage bucket, which migration `20260928000000_profile_photos.sql` creates.

## Build and load the data

Download `recipes_data.csv` from Kaggle ("Recipe Dataset (over 2M)") into `backend/data/`, then:

```bash
npm run db:test    # sanity-check the cleaner (25 tests, ~1 s)
npm run db:clean   # CSV → database/bitewise.db (~12 min for 2.2M rows on one core, faster on more)
npm run db:seed    # curated recipes from frontend/constants/recipes.ts
npm run db:push    # reference data + as many imported recipes as fit the size budget
```

- **Order.** Run `db:seed` before or after `db:push`; either works. The push re-links curated recipes to the ingredient catalog at the end.
- **Re-running.** Every step can be re-run safely: the cleaner skips recipes it already has, and the push upserts.
- **Size.** Each imported recipe uses about 4.3 KB in Postgres. The upload checks the database size as it goes and stops at a budget: `--max-db-mb`, default **450 MB**. The Free plan turns **read-only** above 500 MB, which would break sign-ups, favorites and chat, so the default leaves a safe margin; that fits roughly 100,000 recipes. On the Pro plan (8 GB included), run `npx tsx scripts/pushCleanedRecipes.ts --db database/bitewise.db --max-db-mb 7500`. Add `--limit 20000` to cap the count instead.
- **Which recipes get pushed.** Fully recognized recipes go first, so a limit keeps the ones safest for allergic users. Every recipe is sorted into breakfast, brunch, lunch, dinner and/or dessert (`database/cleaning/meal_types.py`). Drinks, sauces, dips and plain side dishes aren't pushed, and neither are recipes whose macros can't be measured, because the app's `Recipe` type requires `nutrition` and `plate`.

## Tagging the curated recipes

`npm run db:tag-curated` runs the recipes in `frontend/constants/recipes.ts` through the same cleaner as the imported ones. It computes health, lifestyle and allergen-free tags (`diabetic-friendly`, `heart-healthy`, `low-sodium`, `nut-free`, ...) and prints a review list. The review list flags anything in the hand-written data that looks wrong: a missing allergen, a diet tag an ingredient contradicts, or calories that don't match the ingredients.

```bash
npm run db:tag-curated          # report only
npm run db:tag-curated:write    # add the tags to recipes.ts
git diff ../frontend/constants/recipes.ts
npm run db:seed                 # send the updated recipes to Supabase
```

- **Meal types.** It also writes a `mealTypes: [...]` line into each recipe. Every curated recipe stays a dinner; lunch, breakfast or brunch are added where they fit.
- **Hand-set tags are safe.** Tags your team sets by hand (`vegan`, `halal`, `keto`, `low-carb`, `high-protein`, `gluten-free`, `dairy-free`, ...) are never changed.
- **Allergen-free tags need agreement.** One is only added when the cleaner and the recipe's `allergens` list agree the allergen is absent.
- **Safe to re-run.** Re-run it whenever you add or edit a curated recipe: computed tags are recalculated from scratch each time.
- **Fix warnings by hand.** The review list's warnings are never fixed automatically. Correct them in `recipes.ts`, then re-run.

## How it fits the app

- **Vocabulary.** Tags and allergens use the same ids as `frontend/types/index.ts` (`eggs`, `nuts`, `halal`, `keto`, ...). The new tags (`diabetic-friendly`, `heart-healthy`, `nut-free`, ...) and allergens (`wheat`, `nightshade`, ...) were added to those unions. `halal` and `keto` follow the definitions written in that file.
- **Pantry and preferences stay on the phone.** `pantryApi.ts` sends the AsyncStorage pantry and `UserPreferences` with each call. The database matches pantry names to its ingredient catalog, so "Chicken Breast" satisfies a recipe that says "chicken".
- **Safety.** Allergy and diet filtering happens in the database on every call:
  - a recipe is only shown if its allergens are verified and it neither contains nor may contain anything the user avoids;
  - a recipe must carry every diet tag the user chose.
- **The app checks again before suggesting anything.** `frontend/utils/recipeSafety.ts` `validateRecipe()` returns `safe`, `review` or `rejected` with reasons. It checks the labels above, and it also scans the ingredient names, so a recipe that claims "vegan" but lists honey is rejected. Only `safe` recipes are suggested. Missing data, vague ingredients ("broth" for a vegetarian) and errors during the check all count as `review`, never as safe. Every suggestion screen uses it through `passesDietaryFilter`. **Any new recipe source (AI-generated, a new import) must pass its recipes through `screenRecipesForUser()` before showing them.**
- **Server-side tables for later.** `user_pantry`, `user_allergens` and `user_diet_tags` exist for when you want pantries to sync across devices. The pantry functions use them when no pantry is passed in.
- **Favorites (Task 1.6).** Hearts are stored in the `favorites` table, one row per user and recipe. A trigger keeps `recipes.favorite_count` up to date, and the app shows it as "Saved by N cooks".
- **Chat rooms (Task 1.7).**
  - The tables are `chat_rooms`, `room_members` and `messages`. Only members can read or post in a room.
  - Six starter rooms are created by the migration. Users can create more rooms, and a room's creator joins it automatically.
  - Messages can carry a recipe card.
  - Live updates use Supabase Realtime; the migration adds `messages` to the `supabase_realtime` publication.
- **Home recipes (Task 1.7).**
  - Users insert recipes with `source = 'community'`.
  - A trigger matches the ingredients and sets allergens, "may contain" and diet tags. Users can't set those columns, and they can't change save counts either.
  - An unrecognized ingredient means `allergens_verified = false`, so the recipe is never shown to users with allergies.
  - Shared recipes take part in pantry matching and suggestions like any other recipe.
- **Profiles.** A trigger creates a profile (username from sign-up) for every account, which chat and shared recipes use.
- **`docker-compose.yml`.** The Postgres it starts isn't used by any of this, since Supabase hosts the database. For a fully local setup, use `npx supabase start` (needs Docker), which runs the same stack locally.
- **`frontend/hooks/usePantry.ts`.** It points at a REST endpoint (`/api/pantry`) that doesn't exist. Supabase replaces that.

## AI recipes ("Create with AI")

The app can ask Claude to write new recipes from the user's ingredients, meal, number of people and preferences. Open it from Home → **Create with AI**, or from **Cook with my pantry**.

### Which model, and why

| | Choice |
|---|---|
| Model | **Claude Opus 5.5** (`claude-opus-5-5`) through the Anthropic API, official TypeScript SDK (`npm:@anthropic-ai/sdk`) |
| Structured data | Structured outputs (`output_config.format` with a JSON schema in `functions/generate-recipes/generation.ts`). Every reply has the same fields: name, description, ingredients with quantities, steps, servings, times, nutrition, plate, claimed diets and allergens. |
| Cost | $4 per million input tokens, $20 per million output tokens. One request (up to 3 recipes) is roughly 1–2K tokens in and 3–6K out, so about **5–12 cents**. This is an estimate; check `usage` in the Anthropic Console once it's live. |
| Response time | Not measured yet. Expect tens of seconds for three recipes. Effort is set to `low` to keep it quick. The app waits up to 120 s and the function up to 110 s. |
| Cheaper options | Set the `BITEWISE_AI_MODEL` secret. `claude-sonnet-5-5` costs about half ($2 / $10). `claude-haiku-5-5` costs about 1/40 ($0.10 / $0.50), but it has no server-side fallback if a request is declined. Recipes still go through the same safety checks whichever model you pick. |
| Refusals | `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): if a safety classifier declines, the API retries on Anthropic's recommended fallback model. |

### How the app talks to it

```
app (lib/aiRecipesApi.ts)
  → supabase.functions.invoke('generate-recipes', { ingredients, mealType, servings, count, pantryOnly, note, preferences })
      Edge Function: checks the sign-in, hourly limit (BITEWISE_AI_HOURLY_LIMIT, default 20),
      calls Claude, then labels each recipe with analyze_ingredients() (same catalog and rules as shared recipes)
  ← { recipes: [{ recipe, labels }], model }   or   { error: { code, message } }
app: normalizes each recipe (utils/aiRecipes.ts), runs the safety check (utils/recipeSafety.ts),
     shows only the safe ones and lists the rest with the reason they were held back
```

- **Unverified until checked.** The AI's own diet and allergen claims are stored as `recipe.ai.claimedDietary` / `claimedAllergens` and shown as unverified. The labels the safety check uses come from the ingredient catalog. Allergens can only be added to (the AI's admitted allergens are included), never removed. If the catalog check fails, the recipe counts as unverified and is held back from anyone with allergies or diet rules.
- **Failures never crash the app.** A declined request, a cut-off or unreadable reply, a timeout, a missing key, or the hourly limit all come back as an `error.code` with a message the screen shows. A recipe missing its name, ingredients or steps is dropped and counted.
- **Where generated recipes live.** They aren't saved to the database. The phone keeps the last 40 (AsyncStorage) so the recipe screen can open them.

### Setup (once), from `backend/`

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...     # from console.anthropic.com
npx supabase db push                                       # adds analyze_ingredients + the rate-limit table
npx supabase functions deploy generate-recipes
npx deno test supabase/functions/generate-recipes/         # optional: the function's own tests
```

## Improving the ingredient matcher

After `db:clean`, open `database/unmatched_ingredients.csv` to find ingredients the catalog doesn't know yet. Add them to `database/cleaning/catalog.py`, run `npm run db:test`, then re-run `db:clean` (with `--fresh`) and `db:push`.
