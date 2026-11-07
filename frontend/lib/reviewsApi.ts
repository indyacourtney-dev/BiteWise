import { supabase, configured } from './supabase';
import type { RecipeRatingFeedback } from '../types';

const MAX_REVIEW_LENGTH = 300;
const REVIEW_SELECT = 'user_id, rating, comment, created_at, updated_at';

interface ReviewRow {
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
}

interface RecipeFeedbackRow {
  recipe_id: string;
  rating: number;
  recipes: {
    tags: string[] | null;
    dietary: string[] | null;
    vibe: RecipeRatingFeedback['vibe'];
    ingredients: { name: string }[] | null;
  } | {
    tags: string[] | null;
    dietary: string[] | null;
    vibe: RecipeRatingFeedback['vibe'];
    ingredients: { name: string }[] | null;
  }[] | null;
}

export interface RecipeReview {
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
}

export interface RecipeReviewData {
  averageRating: number | null;
  totalReviews: number;
  reviews: RecipeReview[];
  ownReview: RecipeReview | null;
}

function assertConfigured() {
  if (!configured) {
    throw new Error('Reviews need the Supabase backend. Add the keys to frontend/.env.');
  }
}

function toReview(row: ReviewRow, authorName: string | null): RecipeReview {
  return {
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName,
  };
}

export async function fetchRecipeReviews(recipeId: string): Promise<RecipeReviewData> {
  assertConfigured();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);

  const reviewQuery = supabase
    .from('recipe_reviews')
    .select(REVIEW_SELECT)
    .eq('recipe_id', recipeId)
    .order('updated_at', { ascending: false })
    .limit(50);
  const ownReviewQuery = sessionData.session?.user
    ? supabase
        .from('recipe_reviews')
        .select(REVIEW_SELECT)
        .eq('recipe_id', recipeId)
        .eq('user_id', sessionData.session.user.id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [statsResult, reviewsResult, ownResult] = await Promise.all([
    supabase
      .from('recipe_review_stats')
      .select('average_rating, review_count')
      .eq('recipe_id', recipeId)
      .maybeSingle(),
    reviewQuery,
    ownReviewQuery,
  ]);
  if (statsResult.error) throw new Error(statsResult.error.message);
  if (reviewsResult.error) throw new Error(reviewsResult.error.message);
  if (ownResult.error) throw new Error(ownResult.error.message);

  const rows = (reviewsResult.data ?? []) as ReviewRow[];
  const ownRow = ownResult.data as ReviewRow | null;
  const userIds = [...new Set([...rows.map(row => row.user_id), ...(ownRow ? [ownRow.user_id] : [])])];
  const namesByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    if (error) throw new Error(error.message);
    for (const profile of (profiles ?? []) as ProfileRow[]) {
      namesByUserId.set(profile.id, profile.username);
    }
  }

  return {
    averageRating: statsResult.data ? Number(statsResult.data.average_rating) : null,
    totalReviews: Number(statsResult.data?.review_count ?? 0),
    reviews: rows.map(row => toReview(row, namesByUserId.get(row.user_id) ?? null)),
    ownReview: ownRow ? toReview(ownRow, namesByUserId.get(ownRow.user_id) ?? null) : null,
  };
}

export async function saveRecipeReview(
  recipeId: string,
  rating: number,
  comment: string,
): Promise<void> {
  assertConfigured();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Choose a rating from 1 to 5 stars.');
  }
  const cleanedComment = comment.trim();
  if (cleanedComment.length > MAX_REVIEW_LENGTH) {
    throw new Error(`Keep your comment to ${MAX_REVIEW_LENGTH} characters or fewer.`);
  }

  const { error } = await supabase.from('recipe_reviews').upsert(
    {
      recipe_id: recipeId,
      rating,
      comment: cleanedComment || null,
    },
    { onConflict: 'user_id,recipe_id' },
  );
  if (error) throw new Error(error.message);
}

export async function deleteRecipeReview(recipeId: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase.from('recipe_reviews').delete().eq('recipe_id', recipeId);
  if (error) throw new Error(error.message);
}

export async function fetchMyRatingFeedback(): Promise<RecipeRatingFeedback[]> {
  assertConfigured();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('recipe_reviews')
    .select('recipe_id, rating, recipes(tags, dietary, vibe, ingredients)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as RecipeFeedbackRow[]).flatMap(row => {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    if (!recipe) return [];
    return [{
      recipeId: row.recipe_id,
      rating: row.rating,
      tags: recipe.tags ?? [],
      dietary: recipe.dietary ?? [],
      vibe: recipe.vibe,
      ingredients: (recipe.ingredients ?? []).map((ingredient: { name: string }) => ingredient.name),
    }];
  });
}
