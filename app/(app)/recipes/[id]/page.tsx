import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Recipe" };

export default function RecipeDetailPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Recipe"
        title="Recipe detail"
        description="The full recipe view — ingredients, steps, photos, and history."
      />
      <EmptyState
        icon={<BookIcon className="h-6 w-6" />}
        title="Recipe view not built yet"
        description="Recipe detail is built out in a later phase, once recipes exist to show."
      />
    </div>
  );
}
