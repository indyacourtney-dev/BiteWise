-- backend/database/schema.sql
--
-- SQLite schema for the cleaned BiteWise recipe database.
--
-- Built and filled by import_recipes.py. The file has two parts:
-- tables first, then indexes after the "@indexes" marker. The import
-- script creates indexes only after the bulk load, which is much faster
-- than keeping them updated row by row.
--
-- Conventions: ingredient / allergen / tag ids are the snake_case or
-- kebab-case strings from database/cleaning/*.py. Nutrition columns on
-- `recipes` are PER SERVING; on `ingredients` they are PER 100 g.

PRAGMA foreign_keys = ON;

-- =====================================================================
-- REFERENCE DATA (from cleaning/*.py)
-- =====================================================================

CREATE TABLE IF NOT EXISTS allergens (
    id          TEXT PRIMARY KEY,          -- 'tree_nut'
    label       TEXT NOT NULL,             -- 'Tree nuts'
    free_tag    TEXT NOT NULL,             -- 'nut-free' (the tag a safe recipe carries)
    avoid       TEXT NOT NULL              -- foods to avoid, shown to users
);

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,          -- 'diabetic-friendly'
    label       TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('allergen_free', 'diet', 'religious', 'health')),
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
    id              TEXT PRIMARY KEY,      -- 'tomato'
    name            TEXT NOT NULL,         -- 'Tomato'
    category        TEXT NOT NULL,         -- proteins, dairy, grains, produce, pantry, ...
    parent_id       TEXT REFERENCES ingredients(id),
    is_staple       INTEGER NOT NULL DEFAULT 0,   -- salt, pepper, water: never "missing"
    -- nutrition per 100 g
    kcal            REAL, protein_g REAL, carbs_g REAL, fat_g REAL, sat_fat_g REAL,
    fiber_g         REAL, sugar_g REAL, sodium_mg REAL, cholesterol_mg REAL,
    density_g_ml    REAL,
    each_g          REAL
);

-- Every spelling the dataset uses, mapped to one canonical ingredient.
CREATE TABLE IF NOT EXISTS ingredient_aliases (
    alias           TEXT PRIMARY KEY,      -- normalised: lower-case, singular ('diced tomato')
    ingredient_id   TEXT NOT NULL REFERENCES ingredients(id)
);

CREATE TABLE IF NOT EXISTS ingredient_allergens (
    ingredient_id   TEXT NOT NULL REFERENCES ingredients(id),
    allergen_id     TEXT NOT NULL REFERENCES allergens(id),
    level           TEXT NOT NULL CHECK (level IN ('contains', 'may_contain')),
    PRIMARY KEY (ingredient_id, allergen_id)
);

CREATE TABLE IF NOT EXISTS ingredient_flags (
    ingredient_id   TEXT NOT NULL REFERENCES ingredients(id),
    flag            TEXT NOT NULL,         -- 'mammal', 'added_sugar', 'high_fodmap', ...
    PRIMARY KEY (ingredient_id, flag)
);

-- (ingredient, ancestor) pairs including itself at depth 0.
-- 'chicken_breast' -> 'chicken_breast' (0), 'chicken' (1).
-- Pantry matching: a pantry item covers a recipe ingredient when the
-- recipe ingredient is the item itself or one of its ancestors.
CREATE TABLE IF NOT EXISTS ingredient_ancestors (
    ingredient_id   TEXT NOT NULL REFERENCES ingredients(id),
    ancestor_id     TEXT NOT NULL REFERENCES ingredients(id),
    depth           INTEGER NOT NULL,
    PRIMARY KEY (ingredient_id, ancestor_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS substitutions (
    id                  TEXT PRIMARY KEY,
    from_ingredient_id  TEXT NOT NULL REFERENCES ingredients(id),
    to_ingredient_id    TEXT REFERENCES ingredients(id),   -- NULL = a technique tip
    tip                 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS substitution_helps (
    substitution_id TEXT NOT NULL REFERENCES substitutions(id),
    tag_id          TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (substitution_id, tag_id)
);

-- =====================================================================
-- RECIPES (from the Kaggle CSV)
-- =====================================================================

CREATE TABLE IF NOT EXISTS recipes (
    id                      INTEGER PRIMARY KEY,
    source_key              TEXT NOT NULL UNIQUE,   -- source link; used to skip duplicates / resume imports
    title                   TEXT NOT NULL,
    source_url              TEXT,
    site                    TEXT,
    directions              TEXT NOT NULL,          -- JSON array of steps
    ingredient_count        INTEGER NOT NULL,       -- all lines
    required_count          INTEGER NOT NULL,       -- lines that aren't optional or staples
    all_ingredients_known   INTEGER NOT NULL,       -- 1 = every line matched the catalog
    nutrition_coverage      REAL NOT NULL,          -- 0..1 share of lines with a known weight
    servings                INTEGER NOT NULL,
    servings_estimated      INTEGER NOT NULL,       -- 1 = no "serves N" in the recipe; ~500 kcal portions
    -- per serving
    kcal REAL, protein_g REAL, carbs_g REAL, net_carbs_g REAL, fat_g REAL, sat_fat_g REAL,
    fiber_g REAL, sugar_g REAL, added_sugar_g REAL, sodium_mg REAL, cholesterol_mg REAL,
    -- macro split, % of calories
    pct_kcal_protein REAL, pct_kcal_carbs REAL, pct_kcal_fat REAL,
    meal_types              TEXT NOT NULL DEFAULT '[]'  -- JSON array: breakfast, brunch, lunch, dinner, dessert
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    recipe_id       INTEGER NOT NULL REFERENCES recipes(id),
    position        INTEGER NOT NULL,
    ingredient_id   TEXT REFERENCES ingredients(id),  -- NULL = not recognised (see unmatched_ingredients)
    raw_text        TEXT NOT NULL,                     -- original line, untouched
    quantity        REAL,
    unit            TEXT,
    grams           REAL,
    form            TEXT,                              -- 'canned', 'fresh', 'frozen', ...
    preparation     TEXT,                              -- 'diced, drained'
    is_optional     INTEGER NOT NULL DEFAULT 0,
    is_required     INTEGER NOT NULL,                  -- 1 = counts toward pantry matching
    PRIMARY KEY (recipe_id, position)
);

CREATE TABLE IF NOT EXISTS recipe_allergens (
    recipe_id       INTEGER NOT NULL REFERENCES recipes(id),
    allergen_id     TEXT NOT NULL REFERENCES allergens(id),
    level           TEXT NOT NULL CHECK (level IN ('contains', 'may_contain')),
    PRIMARY KEY (recipe_id, allergen_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS recipe_tags (
    recipe_id       INTEGER NOT NULL REFERENCES recipes(id),
    tag_id          TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (recipe_id, tag_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS recipe_substitutions (
    recipe_id       INTEGER NOT NULL REFERENCES recipes(id),
    substitution_id TEXT NOT NULL REFERENCES substitutions(id),
    PRIMARY KEY (recipe_id, substitution_id)
) WITHOUT ROWID;

-- Ingredient text the cleaner could not match, most common first.
-- Use it to decide what to add to cleaning/catalog.py next.
CREATE TABLE IF NOT EXISTS unmatched_ingredients (
    name_text       TEXT PRIMARY KEY,
    occurrences     INTEGER NOT NULL
);

-- =====================================================================
-- USERS & PANTRY
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    name            TEXT
);

CREATE TABLE IF NOT EXISTS user_pantry (
    user_id         INTEGER NOT NULL REFERENCES users(id),
    ingredient_id   TEXT NOT NULL REFERENCES ingredients(id),
    quantity_note   TEXT,                   -- free text, e.g. '2 cans'
    expires_on      TEXT,                   -- ISO date, optional; drives "use it up"
    added_at        TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, ingredient_id)
);

-- Allergies: recipes must carry the allergen's free_tag to be shown.
CREATE TABLE IF NOT EXISTS user_allergens (
    user_id         INTEGER NOT NULL REFERENCES users(id),
    allergen_id     TEXT NOT NULL REFERENCES allergens(id),
    PRIMARY KEY (user_id, allergen_id)
);

-- Diets and health conditions: recipes must carry EVERY tag listed here
-- (e.g. 'vegetarian', 'diabetic-friendly', 'heart-healthy').
CREATE TABLE IF NOT EXISTS user_diet_tags (
    user_id         INTEGER NOT NULL REFERENCES users(id),
    tag_id          TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (user_id, tag_id)
);

-- @indexes ------------------------------------------------------------

-- Pantry matching: find recipes by ingredient, required lines only.
CREATE INDEX IF NOT EXISTS idx_ri_ingredient_required
    ON recipe_ingredients (ingredient_id, recipe_id) WHERE is_required = 1;
CREATE INDEX IF NOT EXISTS idx_ri_ingredient ON recipe_ingredients (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags (tag_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_allergens_allergen ON recipe_allergens (allergen_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_ancestors_ancestor ON ingredient_ancestors (ancestor_id);
CREATE INDEX IF NOT EXISTS idx_aliases_ingredient ON ingredient_aliases (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes (title);
CREATE INDEX IF NOT EXISTS idx_pantry_expiry ON user_pantry (user_id, expires_on);
