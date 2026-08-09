import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SparkleIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Review & edit" };

export default function RecipeEditPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Refine"
        title="Review & edit"
        description="Check what the importer extracted, fix fields, and confirm before saving."
      />
      <EmptyState
        icon={<SparkleIcon className="h-6 w-6" />}
        title="Review & edit isn't wired up yet"
        description="This screen pairs with the import pipeline in a later phase."
      />
    </div>
  );
}
