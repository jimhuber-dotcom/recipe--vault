import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { UploadIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Capture"
        title="Import"
        description="Bring in a recipe from a screenshot, photo, link, or pasted text."
      />
      <EmptyState
        icon={<UploadIcon className="h-6 w-6" />}
        title="Import isn't wired up yet"
        description="The capture and AI-extraction pipeline arrives in a later phase."
      />
    </div>
  );
}
