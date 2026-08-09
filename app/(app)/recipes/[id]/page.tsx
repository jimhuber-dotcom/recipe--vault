import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRecipeDetail } from "@/lib/recipes";
import { signImagePaths } from "@/lib/storage";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FavoriteButton } from "@/components/recipes/FavoriteButton";
import { DeleteRecipeButton } from "@/components/recipes/DeleteRecipeButton";
import { ClockIcon } from "@/components/nav/icons";
import { RECIPE_STATUS_LABELS } from "@/lib/types";
import type { RecipeIngredient, RecipeStep } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getRecipeDetail(id);
  return { title: detail?.recipe.title ?? "Recipe" };
}

function groupBySection<T extends { section: string | null }>(
  items: T[],
): { section: string | null; items: T[] }[] {
  const groups: { section: string | null; items: T[] }[] = [];
  for (const item of items) {
    const key = item.section ?? null;
    let group = groups.find((g) => g.section === key);
    if (!group) {
      group = { section: key, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function formatQuantity(q: number | string | null): string {
  if (q === null || q === undefined) return "";
  const n = typeof q === "string" ? parseFloat(q) : q;
  if (Number.isNaN(n)) return "";
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(4)));
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getRecipeDetail(id);
  if (!detail) notFound();

  const { recipe, ingredients, steps, tags, images } = detail;

  const signed = await signImagePaths(images.map((img) => img.storage_path));
  const primary = images.find((img) => img.is_primary) ?? images[0] ?? null;
  const primaryUrl = primary ? (signed.get(primary.storage_path) ?? null) : null;

  const ingredientGroups = groupBySection<RecipeIngredient>(ingredients);
  const stepGroups = groupBySection<RecipeStep>(steps);

  const metaChips: string[] = [];
  if (recipe.servings) metaChips.push(`${recipe.servings} servings`);
  if (recipe.cuisine) metaChips.push(recipe.cuisine);
  if (recipe.course) metaChips.push(recipe.course);
  if (recipe.main_protein) metaChips.push(recipe.main_protein);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/library"
          className="text-sm font-medium text-foreground-muted hover:text-foreground"
        >
          ← Library
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-xs text-foreground-muted">
            {recipe.recipe_code}
          </div>
          <h1 className="mt-1 font-display text-3xl text-foreground">
            {recipe.title}
          </h1>
          {recipe.subtitle ? (
            <p className="mt-1 text-lg text-foreground-muted">
              {recipe.subtitle}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              {RECIPE_STATUS_LABELS[recipe.recipe_status]}
            </Badge>
            {recipe.difficulty ? (
              <Badge variant="neutral">
                <span className="capitalize">{recipe.difficulty}</span>
              </Badge>
            ) : null}
            {recipe.times_cooked > 0 ? (
              <Badge variant="neutral">Cooked {recipe.times_cooked}×</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <FavoriteButton id={recipe.id} initial={recipe.is_favorite} />
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Edit
          </Link>
          <DeleteRecipeButton id={recipe.id} />
        </div>
      </div>

      {/* Hero image + thumbnails */}
      {primaryUrl ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryUrl}
              alt={recipe.title}
              className="max-h-[28rem] w-full object-cover"
            />
          </div>
          {images.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {images.map((img) => {
                const url = signed.get(img.storage_path);
                if (!url) return null;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={url}
                    alt={img.caption ?? ""}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Meta row */}
      {(metaChips.length > 0 ||
        recipe.prep_minutes ||
        recipe.cook_minutes) ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-foreground-muted">
          {recipe.prep_minutes ? (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" /> Prep {recipe.prep_minutes}m
            </span>
          ) : null}
          {recipe.cook_minutes ? (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" /> Cook {recipe.cook_minutes}m
            </span>
          ) : null}
          {recipe.total_minutes ? (
            <span className="font-medium text-foreground">
              Total {recipe.total_minutes}m
            </span>
          ) : null}
          {metaChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      ) : null}

      {recipe.description ? (
        <p className="max-w-2xl whitespace-pre-line text-foreground">
          {recipe.description}
        </p>
      ) : null}

      {/* Ingredients + steps */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <h2 className="font-display text-xl text-foreground">Ingredients</h2>
          {ingredients.length > 0 ? (
            <div className="mt-4 flex flex-col gap-5">
              {ingredientGroups.map((group, gi) => (
                <div key={gi}>
                  {group.section ? (
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">
                      {group.section}
                    </h3>
                  ) : null}
                  <ul className="flex flex-col gap-2">
                    {group.items.map((ing) => (
                      <li key={ing.id} className="flex gap-2 text-sm">
                        <span className="min-w-0 text-foreground">
                          <span className="font-medium">
                            {[formatQuantity(ing.quantity), ing.unit]
                              .filter(Boolean)
                              .join(" ")}
                          </span>{" "}
                          {ing.item}
                          {ing.preparation ? (
                            <span className="text-foreground-muted">
                              , {ing.preparation}
                            </span>
                          ) : null}
                          {ing.is_optional ? (
                            <span className="text-foreground-muted">
                              {" "}
                              (optional)
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-foreground-muted">
              No ingredients listed.
            </p>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="font-display text-xl text-foreground">Steps</h2>
          {steps.length > 0 ? (
            <div className="mt-4 flex flex-col gap-6">
              {stepGroups.map((group, gi) => (
                <div key={gi}>
                  {group.section ? (
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
                      {group.section}
                    </h3>
                  ) : null}
                  <ol className="flex flex-col gap-4">
                    {group.items.map((step, si) => (
                      <li key={step.id} className="flex gap-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-medium text-primary">
                          {si + 1}
                        </span>
                        <p className="whitespace-pre-line text-foreground">
                          {step.instruction}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-foreground-muted">
              No steps listed.
            </p>
          )}
        </section>
      </div>

      {/* Tags */}
      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <Badge key={tag.id} variant="neutral">
              {tag.name}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Notes */}
      {recipe.notes ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg text-foreground">Notes</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground">
            {recipe.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
