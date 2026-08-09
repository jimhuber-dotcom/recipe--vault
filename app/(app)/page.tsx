import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { SearchBox } from "@/components/dashboard/SearchBox";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  BookIcon,
  CocktailIcon,
  InboxIcon,
  HeartIcon,
  FolderIcon,
  UploadIcon,
  ChevronRightIcon,
} from "@/components/nav/icons";

// Per-user data behind auth — always render fresh, never statically cached.
export const dynamic = "force-dynamic";

interface RecentRecipe {
  id: string;
  title: string;
  recipe_code: string;
  main_protein: string | null;
  recipe_status: string;
}

interface CollectionRow {
  id: string;
  name: string;
  is_pinned: boolean;
  recipe_collections: { count: number }[] | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // All dashboard reads run as the signed-in user; RLS scopes them. We rely on
  // that rather than filtering by user_id in application code.
  const [
    profileRes,
    recipeCountRes,
    cocktailCountRes,
    recipesNeedsReviewRes,
    importsNeedsReviewRes,
    favoritesCountRes,
    recentRes,
    collectionsRes,
  ] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("recipes")
      .select("id, cocktail_details!inner(recipe_id)", {
        count: "exact",
        head: true,
      })
      .is("deleted_at", null),
    supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("recipe_status", "needs_review")
      .is("deleted_at", null),
    supabase
      .from("imports")
      .select("id", { count: "exact", head: true })
      .in("status", ["needs_review", "duplicate_check"]),
    supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("is_favorite", true)
      .is("deleted_at", null),
    supabase
      .from("recipes")
      .select("id, title, recipe_code, main_protein, recipe_status")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("collections")
      .select("id, name, is_pinned, recipe_collections(count)")
      .order("sort_order", { ascending: true }),
  ]);

  const recipeCount = recipeCountRes.count ?? 0;
  const cocktailCount = cocktailCountRes.count ?? 0;
  const needsReviewCount =
    (recipesNeedsReviewRes.count ?? 0) + (importsNeedsReviewRes.count ?? 0);
  const favoritesCount = favoritesCountRes.count ?? 0;
  const recentRecipes = (recentRes.data as RecentRecipe[] | null) ?? [];
  const collections = (collectionsRes.data as CollectionRow[] | null) ?? [];

  const displayName = profileRes.data?.display_name ?? null;
  const firstName = displayName?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Your kitchen"
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Here's what's in your kitchen."
      />

      <div className="max-w-xl">
        <SearchBox />
      </div>

      {/* Stat cards */}
      <section
        aria-label="Overview"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Recipes"
          value={recipeCount}
          href="/library"
          icon={<BookIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Cocktails"
          value={cocktailCount}
          href="/library"
          icon={<CocktailIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Needs review"
          value={needsReviewCount}
          href="/inbox"
          icon={<InboxIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Favorites"
          value={favoritesCount}
          href="/favorites"
          icon={<HeartIcon className="h-5 w-5" />}
        />
      </section>

      {/* Recently added */}
      <section aria-label="Recently added">
        <Card>
          <div className="flex items-center justify-between p-5 pb-3 sm:p-6 sm:pb-3">
            <CardTitle>Recently added</CardTitle>
            <Link
              href="/library"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
            >
              View library
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {recentRecipes.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentRecipes.map((recipe) => (
                  <li key={recipe.id}>
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="flex items-center gap-3 py-3 transition-colors hover:text-primary"
                    >
                      <span className="font-mono text-xs text-foreground-muted">
                        {recipe.recipe_code}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {recipe.title}
                      </span>
                      {recipe.main_protein ? (
                        <Badge variant="neutral">{recipe.main_protein}</Badge>
                      ) : null}
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<UploadIcon className="h-6 w-6" />}
                title="No recipes yet"
                description="Once you add a recipe, the most recent ones show up here."
                action={
                  <Link
                    href="/recipes/new"
                    className={buttonClasses({ variant: "primary" })}
                  >
                    Add a recipe
                  </Link>
                }
              />
            )}
          </div>
        </Card>
      </section>

      {/* Collections */}
      <section aria-label="Collections" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Collections</h2>
          <Link
            href="/collections"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            All collections
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
        {collections.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => {
              const count = collection.recipe_collections?.[0]?.count ?? 0;
              return (
                <Link key={collection.id} href="/collections" className="block">
                  <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-card-hover">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-accent">
                      <FolderIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        {collection.name}
                      </div>
                      <div className="text-sm text-foreground-muted">
                        {count} {count === 1 ? "recipe" : "recipes"}
                      </div>
                    </div>
                    {collection.is_pinned ? (
                      <Badge variant="accent">Pinned</Badge>
                    ) : null}
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<FolderIcon className="h-6 w-6" />}
            title="No collections yet"
            description="Your default collections will appear here."
          />
        )}
      </section>
    </div>
  );
}
