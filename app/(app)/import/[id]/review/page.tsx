import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserTags, getUserCollections } from "@/lib/recipes";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { SparkleIcon } from "@/components/nav/icons";
import { RecipeForm, type RecipeFormInitial } from "@/components/recipes/RecipeForm";
import type { ExtractedRecipe } from "@/lib/ai/extract";

export const metadata: Metadata = { title: "Review import" };
export const dynamic = "force-dynamic";

function numToStr(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : "";
}

export default async function ReviewImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: imp } = await supabase
    .from("imports")
    .select("status, extracted_payload, error_message, recipe_id")
    .eq("id", id)
    .maybeSingle();

  if (!imp) notFound();

  const record = imp as {
    status: string;
    extracted_payload: ExtractedRecipe | null;
    error_message: string | null;
    recipe_id: string | null;
  };

  // Already turned into a recipe — send them to it.
  if (record.recipe_id) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader eyebrow="Import" title="Already imported" />
        <EmptyState
          icon={<SparkleIcon className="h-6 w-6" />}
          title="This import is done"
          description="It was already saved as a recipe."
          action={
            <Link
              href={`/recipes/${record.recipe_id}`}
              className={buttonClasses({ variant: "primary" })}
            >
              View the recipe
            </Link>
          }
        />
      </div>
    );
  }

  const payload = record.extracted_payload;
  if (!payload || record.status === "failed") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader eyebrow="Import" title="Couldn't read that photo" />
        <EmptyState
          icon={<SparkleIcon className="h-6 w-6" />}
          title="Extraction didn't work"
          description={
            record.error_message ??
            "The model couldn't read a recipe from that image. Try a clearer photo."
          }
          action={
            <Link href="/import" className={buttonClasses({ variant: "primary" })}>
              Try another photo
            </Link>
          }
        />
      </div>
    );
  }

  const [tags, collections] = await Promise.all([
    getUserTags(),
    getUserCollections(),
  ]);

  const initial: RecipeFormInitial = {
    title: payload.title ?? "",
    subtitle: payload.subtitle ?? "",
    description: payload.description ?? "",
    cuisine: payload.cuisine ?? "",
    cooking_method: payload.cooking_method ?? "",
    course: payload.course ?? "",
    main_type: payload.main_type ?? "",
    main_protein: payload.main_protein ?? "",
    yield_text: payload.yield_text ?? "",
    notes: payload.notes ?? "",
    servings: numToStr(payload.servings),
    prep_minutes: numToStr(payload.prep_minutes),
    cook_minutes: numToStr(payload.cook_minutes),
    difficulty: payload.difficulty ?? "",
    recipe_status: "reconstructed_from_photo",
    is_favorite: false,
    ingredients: (payload.ingredients ?? []).map((i) => ({
      section: i.section ?? "",
      quantity: numToStr(i.quantity),
      unit: i.unit ?? "",
      item: i.item ?? "",
      preparation: i.preparation ?? "",
      is_optional: i.is_optional === true,
    })),
    steps: (payload.steps ?? []).map((s) => ({
      section: s.section ?? "",
      instruction: s.instruction ?? "",
    })),
    tagIds: [],
    collectionIds: [],
  };

  const reviewFlags = payload.ai_review_flags ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Review & edit"
        title="Check what Claude read"
        description="Claude read the photo and filled in the rest to make it cookable. Check the highlighted parts, fix anything that's off, then save. The photo becomes the cover."
      />

      {reviewFlags.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-foreground">
            Claude filled in some gaps — worth a quick check:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            {reviewFlags.map((flag, i) => (
              <li key={i}>
                <span className="font-medium capitalize text-foreground">
                  {flag.field.replace(/_/g, " ")}
                </span>
                {" — "}
                {flag.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <RecipeForm
        mode="create"
        importId={id}
        tags={tags}
        collections={collections}
        initial={initial}
      />
    </div>
  );
}
