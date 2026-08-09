/**
 * Hand-written domain types mirroring the columns Migration 001 defines. We keep
 * the Supabase clients untyped and cast query results to these, which is safer
 * than swapping in generated types mid-project (the generated select-string
 * parser is strict and would churn existing queries).
 */

export type Difficulty = "easy" | "medium" | "hard";

export const RECIPE_STATUSES = [
  "original_complete",
  "cleaned_up",
  "reconstructed_from_photo",
  "needs_review",
  "tested",
] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export interface Recipe {
  id: string;
  user_id: string;
  recipe_number: number;
  recipe_code: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cuisine: string | null;
  cooking_method: string | null;
  course: string | null;
  main_type: string | null;
  main_protein: string | null;
  yield_text: string | null;
  notes: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  difficulty: Difficulty | null;
  recipe_status: RecipeStatus;
  photo_status: string;
  confidence: string;
  lifecycle_status: string;
  source_id: string | null;
  is_favorite: boolean;
  do_not_make_again: boolean;
  rating: number | null;
  times_cooked: number;
  last_cooked_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  user_id: string;
  position: number;
  section: string | null;
  quantity: number | null;
  unit: string | null;
  item: string;
  preparation: string | null;
  raw_text: string | null;
  is_optional: boolean;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  user_id: string;
  step_number: number;
  section: string | null;
  instruction: string;
  duration_minutes: number | null;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  tag_type: string;
  color: string | null;
  is_default: boolean;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_pinned: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface RecipeImage {
  id: string;
  recipe_id: string;
  user_id: string;
  bucket_id: string;
  storage_path: string;
  is_primary: boolean;
  position: number;
  caption: string | null;
  content_type: string | null;
  byte_size: number | null;
  width_px: number | null;
  height_px: number | null;
  image_origin: string | null;
  created_at: string;
}

/** A recipe row plus the primary image path, for list/card rendering. */
export interface RecipeCardData {
  id: string;
  recipe_code: string;
  title: string;
  subtitle: string | null;
  main_protein: string | null;
  course: string | null;
  difficulty: Difficulty | null;
  total_minutes: number | null;
  is_favorite: boolean;
  recipe_status: RecipeStatus;
  created_at: string;
}

/** Human labels for the recipe_status enum. */
export const RECIPE_STATUS_LABELS: Record<RecipeStatus, string> = {
  original_complete: "Original",
  cleaned_up: "Cleaned up",
  reconstructed_from_photo: "Reconstructed",
  needs_review: "Needs review",
  tested: "Tested",
};

// --- Editor form input (passed from the client form to the server actions) ---

export interface IngredientInput {
  section: string | null;
  quantity: number | null;
  unit: string | null;
  item: string;
  preparation: string | null;
  is_optional: boolean;
}

export interface StepInput {
  section: string | null;
  instruction: string;
  duration_minutes: number | null;
}

export interface RecipeFormInput {
  title: string;
  subtitle: string | null;
  description: string | null;
  cuisine: string | null;
  cooking_method: string | null;
  course: string | null;
  main_type: string | null;
  main_protein: string | null;
  yield_text: string | null;
  notes: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  difficulty: Difficulty | null;
  recipe_status: RecipeStatus;
  is_favorite: boolean;
  ingredients: IngredientInput[];
  steps: StepInput[];
  tagIds: string[];
  collectionIds: string[];
}
