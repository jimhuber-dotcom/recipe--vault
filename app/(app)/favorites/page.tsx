import Link from "next/link";
import type { Metadata } from "next";
import { getRecipeCards } from "@/lib/recipes";
import { signImagePaths } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { HeartIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Favorites" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const cards = await getRecipeCards({ sort: "newest", favorite: true });
  const paths = cards
    .map((c) => c.primaryImagePath)
    .filter((p): p is string => Boolean(p));
  const signed = await signImagePaths(paths);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Saved"
        title="Favorites"
        description="The recipes you keep coming back to."
      />

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
          icon={<HeartIcon className="h-6 w-6" />}
          title="No favorites yet"
          description="Mark a recipe as a favorite and it will show up here."
          action={
            <Link href="/library" className={buttonClasses({ variant: "secondary" })}>
              Browse library
            </Link>
          }
        />
      )}
    </div>
  );
}
