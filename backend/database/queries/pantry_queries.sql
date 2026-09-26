-- backend/database/queries/pantry_queries.sql
--
-- Recipe lookups driven by what's in a user's pantry (SQLite).
-- Each query starts with "-- name: <query_name>" so pantry.py can load
-- them by name. Parameters use :named style.
--
-- HOW PANTRY MATCHING WORKS
-- * A pantry item covers a recipe ingredient when the recipe asks for
--   the item itself OR something more general it can stand in for:
--   chicken_breast in the pantry covers "chicken", but a pantry "chicken"
--   doesn't cover "chicken breast". (ingredient_ancestors)
-- * Only REQUIRED lines count: optional garnishes and staples
--   (salt, pepper, water, cooking spray, baking soda/powder) are never
--   "missing".
-- * Ingredient lines the cleaner couldn't recognise count as missing.
--
-- HOW SAFETY FILTERING WORKS (every recipe-listing query applies it)
-- * Allergies: a recipe is shown only if it carries the allergen's
--   free tag (nut-free, gluten-free, ...). That tag is only given when
--   every line was recognised and nothing contains or may contain the
--   allergen, so "unknown" is treated as unsafe.
-- * Diets & health conditions: a recipe must carry every tag in
--   user_diet_tags (vegan, diabetic-friendly, heart-healthy, ...).


-- name: pantry_matches
-- Best recipes for what the user has. Ranked by fewest missing
-- ingredients, then by share of the recipe covered.
-- :user_id      user
-- :max_missing  how many required ingredients may be missing (0 = cook now)
-- :min_match    minimum share of required ingredients the user has (0..1)
-- :limit        rows to return
WITH covered AS (
    SELECT DISTINCT a.ancestor_id AS ingredient_id
    FROM user_pantry p
    JOIN ingredient_ancestors a ON a.ingredient_id = p.ingredient_id
    WHERE p.user_id = :user_id
),
have AS (
    SELECT ri.recipe_id, COUNT(*) AS have_count
    FROM recipe_ingredients ri
    JOIN covered c ON c.ingredient_id = ri.ingredient_id
    WHERE ri.is_required = 1
    GROUP BY ri.recipe_id
),
ranked AS (
    SELECT r.id, r.title, r.required_count,
           h.have_count,
           r.required_count - h.have_count            AS missing_count,
           ROUND(1.0 * h.have_count / r.required_count, 2) AS match_ratio,
           r.servings, r.servings_estimated,
           r.kcal, r.protein_g, r.carbs_g, r.fat_g, r.fiber_g, r.sodium_mg
    FROM have h
    JOIN recipes r ON r.id = h.recipe_id
    WHERE r.required_count > 0
      AND r.required_count - h.have_count <= :max_missing
      AND 1.0 * h.have_count / r.required_count >= :min_match
      -- allergy filter
      AND NOT EXISTS (
          SELECT 1 FROM user_allergens ua
          JOIN allergens al ON al.id = ua.allergen_id
          WHERE ua.user_id = :user_id
            AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = al.free_tag))
      -- diet / health-condition filter
      AND NOT EXISTS (
          SELECT 1 FROM user_diet_tags ud
          WHERE ud.user_id = :user_id
            AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = ud.tag_id))
    ORDER BY missing_count ASC, match_ratio DESC, r.nutrition_coverage DESC, r.id
    LIMIT :limit
)
SELECT ranked.*,
       (SELECT GROUP_CONCAT(COALESCE(i.name, ri.raw_text), ' | ')
        FROM recipe_ingredients ri
        LEFT JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ranked.id
          AND ri.is_required = 1
          AND (ri.ingredient_id IS NULL OR ri.ingredient_id NOT IN (SELECT ingredient_id FROM covered))
       ) AS missing_ingredients
FROM ranked
ORDER BY missing_count ASC, match_ratio DESC;


-- name: cook_now
-- Recipes the user can make right now with nothing missing.
-- :user_id, :limit
WITH covered AS (
    SELECT DISTINCT a.ancestor_id AS ingredient_id
    FROM user_pantry p
    JOIN ingredient_ancestors a ON a.ingredient_id = p.ingredient_id
    WHERE p.user_id = :user_id
),
have AS (
    SELECT ri.recipe_id, COUNT(*) AS have_count
    FROM recipe_ingredients ri
    JOIN covered c ON c.ingredient_id = ri.ingredient_id
    WHERE ri.is_required = 1
    GROUP BY ri.recipe_id
)
SELECT r.id, r.title, r.required_count, r.kcal, r.protein_g, r.carbs_g, r.fat_g
FROM have h
JOIN recipes r ON r.id = h.recipe_id
WHERE h.have_count = r.required_count
  AND r.required_count > 0
  AND NOT EXISTS (
      SELECT 1 FROM user_allergens ua
      JOIN allergens al ON al.id = ua.allergen_id
      WHERE ua.user_id = :user_id
        AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = al.free_tag))
  AND NOT EXISTS (
      SELECT 1 FROM user_diet_tags ud
      WHERE ud.user_id = :user_id
        AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = ud.tag_id))
ORDER BY r.required_count DESC, r.nutrition_coverage DESC
LIMIT :limit;


-- name: use_it_up
-- Recipes that use the most pantry items expiring within :days days.
-- :user_id, :days, :max_missing, :limit
WITH expiring AS (
    SELECT DISTINCT a.ancestor_id AS ingredient_id
    FROM user_pantry p
    JOIN ingredient_ancestors a ON a.ingredient_id = p.ingredient_id
    WHERE p.user_id = :user_id
      AND p.expires_on IS NOT NULL
      AND p.expires_on <= date('now', '+' || :days || ' days')
),
covered AS (
    SELECT DISTINCT a.ancestor_id AS ingredient_id
    FROM user_pantry p
    JOIN ingredient_ancestors a ON a.ingredient_id = p.ingredient_id
    WHERE p.user_id = :user_id
),
uses AS (
    SELECT ri.recipe_id, COUNT(DISTINCT ri.ingredient_id) AS expiring_used
    FROM recipe_ingredients ri
    JOIN expiring e ON e.ingredient_id = ri.ingredient_id
    WHERE ri.is_required = 1
    GROUP BY ri.recipe_id
),
scored AS (
    SELECT u.recipe_id, u.expiring_used,
           (SELECT COUNT(*) FROM recipe_ingredients ri
            WHERE ri.recipe_id = u.recipe_id AND ri.is_required = 1
              AND (ri.ingredient_id IS NULL OR ri.ingredient_id NOT IN (SELECT ingredient_id FROM covered))
           ) AS missing_count
    FROM uses u
)
SELECT r.id, r.title, s.expiring_used, s.missing_count, r.kcal, r.protein_g
FROM scored s
JOIN recipes r ON r.id = s.recipe_id
WHERE s.missing_count <= :max_missing
  AND NOT EXISTS (
      SELECT 1 FROM user_allergens ua
      JOIN allergens al ON al.id = ua.allergen_id
      WHERE ua.user_id = :user_id
        AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = al.free_tag))
  AND NOT EXISTS (
      SELECT 1 FROM user_diet_tags ud
      WHERE ud.user_id = :user_id
        AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = ud.tag_id))
ORDER BY s.expiring_used DESC, s.missing_count ASC
LIMIT :limit;


-- name: recipes_with_ingredients
-- Recipes that use ALL of the given ingredients ("I want something with
-- chicken and broccoli"), safe for the user.
-- :ingredient_ids  JSON array, e.g. '["chicken", "broccoli"]'
-- :user_id, :limit
WITH wanted AS (
    SELECT value AS ingredient_id FROM json_each(:ingredient_ids)
),
hits AS (
    SELECT ri.recipe_id
    FROM recipe_ingredients ri
    JOIN ingredient_ancestors a ON a.ingredient_id = ri.ingredient_id   -- "chicken" also finds chicken thighs
    JOIN wanted w ON w.ingredient_id = a.ancestor_id
    GROUP BY ri.recipe_id
    HAVING COUNT(DISTINCT w.ingredient_id) = (SELECT COUNT(*) FROM wanted)
)
SELECT r.id, r.title, r.required_count, r.kcal, r.protein_g, r.carbs_g, r.fat_g
FROM hits h
JOIN recipes r ON r.id = h.recipe_id
WHERE NOT EXISTS (
      SELECT 1 FROM user_allergens ua
      JOIN allergens al ON al.id = ua.allergen_id
      WHERE ua.user_id = :user_id
        AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = al.free_tag))
  AND NOT EXISTS (
      SELECT 1 FROM user_diet_tags ud
      WHERE ud.user_id = :user_id
        AND NOT EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag_id = ud.tag_id))
ORDER BY r.required_count ASC, r.nutrition_coverage DESC
LIMIT :limit;


-- name: shopping_list
-- What the user still needs to buy for one recipe.
-- :user_id, :recipe_id
WITH covered AS (
    SELECT DISTINCT a.ancestor_id AS ingredient_id
    FROM user_pantry p
    JOIN ingredient_ancestors a ON a.ingredient_id = p.ingredient_id
    WHERE p.user_id = :user_id
)
SELECT ri.position, ri.ingredient_id, COALESCE(i.name, ri.raw_text) AS item, ri.raw_text,
       ri.quantity, ri.unit, i.category
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON i.id = ri.ingredient_id
WHERE ri.recipe_id = :recipe_id
  AND ri.is_required = 1
  AND (ri.ingredient_id IS NULL OR ri.ingredient_id NOT IN (SELECT ingredient_id FROM covered))
ORDER BY i.category, ri.position;


-- name: safe_substitutions
-- Healthier swaps for one recipe, minus any swap whose replacement
-- contains (or may contain) one of the user's allergens.
-- :user_id, :recipe_id
SELECT s.id, s.from_ingredient_id, fi.name AS replace_this,
       s.to_ingredient_id, ti.name AS with_this, s.tip,
       (SELECT GROUP_CONCAT(sh.tag_id, ', ') FROM substitution_helps sh WHERE sh.substitution_id = s.id) AS helps
FROM recipe_substitutions rs
JOIN substitutions s ON s.id = rs.substitution_id
JOIN ingredients fi ON fi.id = s.from_ingredient_id
LEFT JOIN ingredients ti ON ti.id = s.to_ingredient_id
WHERE rs.recipe_id = :recipe_id
  AND NOT EXISTS (
      SELECT 1 FROM ingredient_allergens ia
      JOIN user_allergens ua ON ua.allergen_id = ia.allergen_id AND ua.user_id = :user_id
      WHERE ia.ingredient_id = s.to_ingredient_id)
ORDER BY
    -- swaps that help the user's own diet tags first
    (SELECT COUNT(*) FROM substitution_helps sh
     JOIN user_diet_tags ud ON ud.tag_id = sh.tag_id AND ud.user_id = :user_id
     WHERE sh.substitution_id = s.id) DESC,
    s.id;


-- name: recipe_detail
-- One recipe with macros, tags, and allergen warnings.
-- :recipe_id
SELECT r.*,
       (SELECT GROUP_CONCAT(rt.tag_id, ', ') FROM recipe_tags rt WHERE rt.recipe_id = r.id) AS tags,
       (SELECT GROUP_CONCAT(al.label, ', ') FROM recipe_allergens ra JOIN allergens al ON al.id = ra.allergen_id
        WHERE ra.recipe_id = r.id AND ra.level = 'contains') AS contains_allergens,
       (SELECT GROUP_CONCAT(al.label, ', ') FROM recipe_allergens ra JOIN allergens al ON al.id = ra.allergen_id
        WHERE ra.recipe_id = r.id AND ra.level = 'may_contain') AS may_contain_allergens
FROM recipes r
WHERE r.id = :recipe_id;


-- name: recipe_ingredients
-- Cleaned ingredient lines for one recipe.
-- :recipe_id
SELECT ri.position, ri.raw_text, ri.ingredient_id, i.name, ri.quantity, ri.unit, ri.grams,
       ri.form, ri.preparation, ri.is_optional
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON i.id = ri.ingredient_id
WHERE ri.recipe_id = :recipe_id
ORDER BY ri.position;


-- name: pantry_list
-- The user's pantry, soonest-expiring first.
-- :user_id
SELECT p.ingredient_id, i.name, i.category, p.quantity_note, p.expires_on, p.added_at
FROM user_pantry p
JOIN ingredients i ON i.id = p.ingredient_id
WHERE p.user_id = :user_id
ORDER BY p.expires_on IS NULL, p.expires_on, i.category, i.name;
