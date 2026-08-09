import type { Metadata } from "next";
import { getUserTags, getUserCollections } from "@/lib/recipes";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecipeForm } from "@/components/recipes/RecipeForm";

export const metadata: Metadata = { title: "New recipe" };
export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const [tags, collections] = await Promise.all([
    getUserTags(),
    getUserCollections(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Create"
        title="New recipe"
        description="Add a recipe by hand. You can add photos after saving."
      />
      <RecipeForm mode="create" tags={tags} collections={collections} />
    </div>
  );
}
