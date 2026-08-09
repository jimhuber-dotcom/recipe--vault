"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RECIPE_IMAGE_BUCKET } from "@/lib/constants";
import type { RecipeFormInput } from "@/lib/types";

type ActionResult = { error?: string; id?: string };

async function requireUserId(): Promise<
  { userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };
  return { userId: user.id };
}

function cleanIngredients(input: RecipeFormInput, userId: string, recipeId: string) {
  return input.ingredients
    .filter((ing) => ing.item.trim().length > 0)
    .map((ing, index) => ({
      recipe_id: recipeId,
      user_id: userId,
      position: index,
      section: ing.section?.trim() || null,
      quantity: ing.quantity,
      unit: ing.unit?.trim() || null,
      item: ing.item.trim(),
      preparation: ing.preparation?.trim() || null,
      is_optional: ing.is_optional,
      raw_text: null,
    }));
}

function cleanSteps(input: RecipeFormInput, userId: string, recipeId: string) {
  return input.steps
    .filter((step) => step.instruction.trim().length > 0)
    .map((step, index) => ({
      recipe_id: recipeId,
      user_id: userId,
      step_number: index + 1,
      section: step.section?.trim() || null,
      instruction: step.instruction.trim(),
      duration_minutes: step.duration_minutes,
    }));
}

function coreRecipeFields(input: RecipeFormInput) {
  return {
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    description: input.description?.trim() || null,
    cuisine: input.cuisine?.trim() || null,
    cooking_method: input.cooking_method?.trim() || null,
    course: input.course?.trim() || null,
    main_type: input.main_type?.trim() || null,
    main_protein: input.main_protein?.trim() || null,
    yield_text: input.yield_text?.trim() || null,
    notes: input.notes?.trim() || null,
    servings: input.servings,
    prep_minutes: input.prep_minutes,
    cook_minutes: input.cook_minutes,
    difficulty: input.difficulty,
    recipe_status: input.recipe_status,
    is_favorite: input.is_favorite,
  };
}

async function insertChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recipeId: string,
  input: RecipeFormInput,
): Promise<string | null> {
  const ingredients = cleanIngredients(input, userId, recipeId);
  if (ingredients.length > 0) {
    const { error } = await supabase.from("recipe_ingredients").insert(ingredients);
    if (error) return error.message;
  }

  const steps = cleanSteps(input, userId, recipeId);
  if (steps.length > 0) {
    const { error } = await supabase.from("recipe_steps").insert(steps);
    if (error) return error.message;
  }

  if (input.tagIds.length > 0) {
    const { error } = await supabase.from("recipe_tags").insert(
      input.tagIds.map((tag_id) => ({
        recipe_id: recipeId,
        tag_id,
        user_id: userId,
      })),
    );
    if (error) return error.message;
  }

  if (input.collectionIds.length > 0) {
    const { error } = await supabase.from("recipe_collections").insert(
      input.collectionIds.map((collection_id, index) => ({
        collection_id,
        recipe_id: recipeId,
        user_id: userId,
        position: index,
      })),
    );
    if (error) return error.message;
  }

  return null;
}

export async function createRecipe(
  input: RecipeFormInput,
): Promise<ActionResult> {
  if (input.title.trim().length === 0) return { error: "A title is required." };

  const auth = await requireUserId();
  if ("error" in auth) return { error: auth.error };
  const { userId } = auth;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .insert({ user_id: userId, ...coreRecipeFields(input) })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create the recipe." };
  }
  const recipeId = (data as { id: string }).id;

  const childErr = await insertChildren(supabase, userId, recipeId, input);
  if (childErr) return { error: childErr, id: recipeId };

  revalidatePath("/library");
  revalidatePath("/");
  return { id: recipeId };
}

export async function updateRecipe(
  id: string,
  input: RecipeFormInput,
): Promise<ActionResult> {
  if (input.title.trim().length === 0) return { error: "A title is required." };

  const auth = await requireUserId();
  if ("error" in auth) return { error: auth.error };
  const { userId } = auth;

  const supabase = await createClient();

  const { error: updateErr } = await supabase
    .from("recipes")
    .update(coreRecipeFields(input))
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  // Replace children wholesale — simplest correct strategy for a single user.
  await Promise.all([
    supabase.from("recipe_ingredients").delete().eq("recipe_id", id),
    supabase.from("recipe_steps").delete().eq("recipe_id", id),
    supabase.from("recipe_tags").delete().eq("recipe_id", id),
    supabase.from("recipe_collections").delete().eq("recipe_id", id),
  ]);

  const childErr = await insertChildren(supabase, userId, id, input);
  if (childErr) return { error: childErr, id };

  revalidatePath("/library");
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/");
  return { id };
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/library");
  revalidatePath("/");
  return {};
}

export async function toggleFavorite(
  id: string,
  next: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ is_favorite: next })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/library");
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/favorites");
  revalidatePath("/");
  return { id };
}

// --- Images -----------------------------------------------------------------

export async function attachRecipeImage(
  recipeId: string,
  storagePath: string,
  meta: { contentType: string | null; byteSize: number | null },
): Promise<ActionResult> {
  const auth = await requireUserId();
  if ("error" in auth) return { error: auth.error };
  const { userId } = auth;

  const supabase = await createClient();

  // Position after any existing images; first image becomes primary.
  const { data: existing } = await supabase
    .from("recipe_images")
    .select("id, position")
    .eq("recipe_id", recipeId);
  const rows = (existing as { id: string; position: number }[] | null) ?? [];
  const isFirst = rows.length === 0;
  const nextPosition = rows.reduce((max, r) => Math.max(max, r.position + 1), 0);

  const { error } = await supabase.from("recipe_images").insert({
    recipe_id: recipeId,
    user_id: userId,
    bucket_id: RECIPE_IMAGE_BUCKET,
    storage_path: storagePath,
    is_primary: isFirst,
    position: nextPosition,
    content_type: meta.contentType,
    byte_size: meta.byteSize,
    image_origin: "original_photo",
  });
  if (error) return { error: error.message };

  if (isFirst) {
    await supabase
      .from("recipes")
      .update({ photo_status: "original_photo" })
      .eq("id", recipeId);
  }

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  revalidatePath("/library");
  return {};
}

export async function setPrimaryImage(
  recipeId: string,
  imageId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  // Clear the current primary first (unique index allows only one).
  const { error: clearErr } = await supabase
    .from("recipe_images")
    .update({ is_primary: false })
    .eq("recipe_id", recipeId)
    .eq("is_primary", true);
  if (clearErr) return { error: clearErr.message };

  const { error } = await supabase
    .from("recipe_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (error) return { error: error.message };

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  revalidatePath("/library");
  return {};
}

export async function deleteRecipeImage(
  recipeId: string,
  imageId: string,
  storagePath: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("recipe_images")
    .select("is_primary")
    .eq("id", imageId)
    .maybeSingle();
  const wasPrimary = (image as { is_primary: boolean } | null)?.is_primary ?? false;

  const { error } = await supabase
    .from("recipe_images")
    .delete()
    .eq("id", imageId);
  if (error) return { error: error.message };

  await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([storagePath]);

  // If we removed the primary, promote the next image (if any) and keep
  // photo_status truthful.
  if (wasPrimary) {
    const { data: remaining } = await supabase
      .from("recipe_images")
      .select("id")
      .eq("recipe_id", recipeId)
      .order("position", { ascending: true })
      .limit(1);
    const next = (remaining as { id: string }[] | null)?.[0];
    if (next) {
      await supabase
        .from("recipe_images")
        .update({ is_primary: true })
        .eq("id", next.id);
    } else {
      await supabase
        .from("recipes")
        .update({ photo_status: "no_image_yet" })
        .eq("id", recipeId);
    }
  }

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  revalidatePath("/library");
  return {};
}
