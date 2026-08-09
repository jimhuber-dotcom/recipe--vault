import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon } from "@/components/nav/icons";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Find"
        title="Search"
        description="Full-text search across titles, ingredients, and notes."
      />
      <EmptyState
        icon={<SearchIcon className="h-6 w-6" />}
        title="Search is coming soon"
        description="The database already maintains a search index. Wiring up the query interface is a later phase."
      />
    </div>
  );
}
