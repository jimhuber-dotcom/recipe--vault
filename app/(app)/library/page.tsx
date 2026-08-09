import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Browse"
        title="Library"
        description="Every recipe you've saved, in one place."
      />
      <EmptyState
        icon={<BookIcon className="h-6 w-6" />}
        title="Your library is empty"
        description="Recipes you add or import will appear here. This screen gets built out in a later phase."
      />
    </div>
  );
}
