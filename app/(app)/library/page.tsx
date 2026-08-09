import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getRecipeCards, type RecipeSort } from "@/lib/recipes";
import { signImagePaths } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { LibraryControls } from "@/components/recipes/LibraryControls";
import { BookIcon, PlusIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

const VALID_SORTS: RecipeSort[] = ["newest", "oldest", "title", "most_cooked"];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; fav?: string }>;
}) {
  const sp = await searchParams;
  const sort: RecipeSort = VALID_SORTS.includes(sp.sort as RecipeSort)
    ? (sp.sort as RecipeSort)
    : "newest";
  const favorite = sp.fav === "1";

  const cards = await getRecipeCards({ sort, favorite });
  const paths = cards
    .map((c) => c.primaryImagePath)
    .filter((p): p is string => Boolean(p));
  const signed = await signImagePaths(paths);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Browse"
        title="Library"
        description="Every recipe you've saved, in one place."
        actions={
          <Link
            href="/recipes/new"
            className={buttonClasses({ variant: "primary" })}
          >
            <PlusIcon className="h-4 w-4" />
            New recipe
          </Link>
        }
      />

      <Suspense fallback={<div className="h-10" />}>
        <LibraryControls />
      </Suspense>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <RecipeCard
              key={card.id}
              item={card}
              imageUrl={
                card.primaryImagePath
                  ? (signed.get(card.primaryImagePath) ?? null)
                  : null
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookIcon className="h-6 w-6" />}
          title={favorite ? "No favorites yet" : "Your library is empty"}
          description={
            favorite
              ? "Recipes you mark as favorites will show up here."
              : "Add your first recipe to get started."
          }
          action={
            favorite ? undefined : (
              <Link
                href="/recipes/new"
                className={buttonClasses({ variant: "primary" })}
              >
                Add a recipe
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
