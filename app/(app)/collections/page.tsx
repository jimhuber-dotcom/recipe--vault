import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FolderIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Organize"
        title="Collections"
        description="Group recipes for a cabin trip, a holiday, or a weeknight rotation."
      />
      <EmptyState
        icon={<FolderIcon className="h-6 w-6" />}
        title="Collections are coming"
        description="Your default collections are already set up. Managing them lands in a later phase."
      />
    </div>
  );
}
