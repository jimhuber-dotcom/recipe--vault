import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { InboxIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Review queue"
        title="Inbox"
        description="Imports waiting to be reviewed, and possible duplicates to resolve."
      />
      <EmptyState
        icon={<InboxIcon className="h-6 w-6" />}
        title="Nothing to review"
        description="Recipes captured through import will queue here for a quick look before they join your library."
      />
    </div>
  );
}
