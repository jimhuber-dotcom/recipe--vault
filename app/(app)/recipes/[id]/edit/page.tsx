import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getRecipeDetail,
  getUserTags,
  getUserCollections,
} from "@/lib/recipes";
import { signImagePaths } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecipeForm, type RecipeFormInitial } from "@/components/recipes/RecipeForm";
import { RecipeImageManager } from "@/components/recipes/RecipeImageManager";

export const metadata: Metadata = { title: "Edit recipe" };
export const dynamic = "force-dynamic";

function numToStr(n: number | string | null): string {
  if (n === null || n === undefined) return "";
  const parsed = parseFloat(String(n));
  return Number.isNaN(parsed) ? "" : String(parsed);
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, tags, collections] = await Promise.all([
    getRecipeDetail(id),
    getUserTags(),
    getUserCollections(),
  ]);
  if (!detail) notFound();

  const { recipe, ingredients, steps, tags: recipeTags, images, collectionIds } =
    detail;

  const initial: RecipeFormInitial = {
    title: recipe.title,
    subtitle: recipe.subtitle ?? "",
    description: recipe.description ?? "",
    cuisine: recipe.cuisine ?? "",
    cooking_method: recipe.cooking_method ?? "",
    course: recipe.course ?? "",
    main_type: recipe.main_type ?? "",
    main_protein: recipe.main_protein ?? "",
    yield_text: recipe.yield_text ?? "",
    notes: recipe.notes ?? "",
    servings: numToStr(recipe.servings),
    prep_minutes: numToStr(recipe.prep_minutes),
    cook_minutes: numToStr(recipe.cook_minutes),
    difficulty: recipe.difficulty ?? "",
    recipe_status: recipe.recipe_status,
    is_favorite: recipe.is_favorite,
    ingredients: ingredients.map((i) => ({
      section: i.section ?? "",
      quantity: numToStr(i.quantity),
      unit: i.unit ?? "",
      item: i.item,
      preparation: i.preparation ?? "",
      is_optional: i.is_optional,
    })),
    steps: steps.map((s) => ({
      section: s.section ?? "",
      instruction: s.instruction,
    })),
    tagIds: recipeTags.map((t) => t.id),
    collectionIds,
  };

  const signed = await signImagePaths(images.map((img) => img.storage_path));
  const imageData = images.map((img) => ({
    id: img.id,
    storagePath: img.storage_path,
    isPrimary: img.is_primary,
    url: signed.get(img.storage_path) ?? null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Edit"
        title="Edit recipe"
        description={recipe.recipe_code}
      />
      <RecipeImageManager recipeId={recipe.id} initialImages={imageData} />
      <RecipeForm
        mode="edit"
        recipeId={recipe.id}
        tags={tags}
        collections={collections}
        initial={initial}
      />
    </div>
  );
}
