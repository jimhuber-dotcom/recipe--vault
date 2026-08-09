import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeartIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Saved"
        title="Favorites"
        description="The recipes you keep coming back to."
      />
      <EmptyState
        icon={<HeartIcon className="h-6 w-6" />}
        title="No favorites yet"
        description="Mark a recipe as a favorite and it will show up here."
      />
    </div>
  );
}
