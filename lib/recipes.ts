import { createClient } from "@/lib/supabase/server";
import type {
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeImage,
  Tag,
  Collection,
} from "@/lib/types";

export type RecipeSort = "newest" | "oldest" | "title" | "most_cooked";

export interface RecipeListItem {
  id: string;
  recipe_code: string;
  title: string;
  subtitle: string | null;
  main_protein: string | null;
  course: string | null;
  difficulty: Recipe["difficulty"];
  total_minutes: number | null;
  is_favorite: boolean;
  recipe_status: Recipe["recipe_status"];
  times_cooked: number;
  created_at: string;
  primaryImagePath: string | null;
}

/** Recipe cards for the Library, RLS-scoped. */
export async function getRecipeCards(params: {
  sort?: RecipeSort;
  favorite?: boolean;
}): Promise<RecipeListItem[]> {
  const supabase = await createClient();

  // Filters live on a FilterBuilder-typed variable; .order() returns a
  // TransformBuilder, so the ordered query is a separate const (assigning it
  // back onto `filtered` would not typecheck).
  let filtered = supabase
    .from("recipes")
    .select(
      "id, recipe_code, title, subtitle, main_protein, course, difficulty, total_minutes, is_favorite, recipe_status, times_cooked, created_at, recipe_images(storage_path, is_primary, position)",
    )
    .is("deleted_at", null);

  if (params.favorite) filtered = filtered.eq("is_favorite", true);

  const ordered =
    params.sort === "title"
      ? filtered.order("title", { ascending: true })
      : params.sort === "oldest"
        ? filtered.order("created_at", { ascending: true })
        : params.sort === "most_cooked"
          ? filtered
              .order("times_cooked", { ascending: false })
              .order("created_at", { ascending: false })
          : filtered.order("created_at", { ascending: false });

  const { data } = await ordered;

  return ((data as RecipeCardRow[] | null) ?? []).map((row) => {
    const images = row.recipe_images ?? [];
    const primary =
      images.find((img) => img.is_primary) ??
      images.slice().sort((a, b) => a.position - b.position)[0];
    return {
      id: row.id,
      recipe_code: row.recipe_code,
      title: row.title,
      subtitle: row.subtitle,
      main_protein: row.main_protein,
      course: row.course,
      difficulty: row.difficulty,
      total_minutes: row.total_minutes,
      is_favorite: row.is_favorite,
      recipe_status: row.recipe_status,
      times_cooked: row.times_cooked,
      created_at: row.created_at,
      primaryImagePath: primary?.storage_path ?? null,
    };
  });
}

interface RecipeCardRow {
  id: string;
  recipe_code: string;
  title: string;
  subtitle: string | null;
  main_protein: string | null;
  course: string | null;
  difficulty: Recipe["difficulty"];
  total_minutes: number | null;
  is_favorite: boolean;
  recipe_status: Recipe["recipe_status"];
  times_cooked: number;
  created_at: string;
  recipe_images: {
    storage_path: string;
    is_primary: boolean;
    position: number;
  }[] | null;
}

export interface RecipeDetail {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: Tag[];
  images: RecipeImage[];
  collectionIds: string[];
}

/** Full recipe with children for the detail and edit screens. RLS-scoped. */
export async function getRecipeDetail(
  id: string,
): Promise<RecipeDetail | null> {
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!recipe) return null;

  const [ingredientsRes, stepsRes, tagsRes, imagesRes, collectionsRes] =
    await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("recipe_steps")
        .select("*")
        .eq("recipe_id", id)
        .order("step_number", { ascending: true }),
      supabase
        .from("recipe_tags")
        .select("tags(*)")
        .eq("recipe_id", id),
      supabase
        .from("recipe_images")
        .select("*")
        .eq("recipe_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("recipe_collections")
        .select("collection_id")
        .eq("recipe_id", id),
    ]);

  const tags = ((tagsRes.data as { tags: Tag | null }[] | null) ?? [])
    .map((row) => row.tags)
    .filter((t): t is Tag => Boolean(t));

  return {
    recipe: recipe as Recipe,
    ingredients: (ingredientsRes.data as RecipeIngredient[] | null) ?? [],
    steps: (stepsRes.data as RecipeStep[] | null) ?? [],
    tags,
    images: (imagesRes.data as RecipeImage[] | null) ?? [],
    collectionIds: (
      (collectionsRes.data as { collection_id: string }[] | null) ?? []
    ).map((r) => r.collection_id),
  };
}

/** The signed-in user's tags, for the editor's tag picker. */
export async function getUserTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("*")
    .order("tag_type", { ascending: true })
    .order("name", { ascending: true });
  return (data as Tag[] | null) ?? [];
}

/** The signed-in user's collections, for the editor's collection picker. */
export async function getUserCollections(): Promise<Collection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data as Collection[] | null) ?? [];
}
