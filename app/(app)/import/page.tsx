import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportUploader } from "@/components/import/ImportUploader";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Capture"
        title="Import a recipe"
        description="Upload a photo and Claude reads it into a recipe you can review and save."
      />
      <div className="max-w-2xl">
        <ImportUploader />
      </div>
    </div>
  );
}
