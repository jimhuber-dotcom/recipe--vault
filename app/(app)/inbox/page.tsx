import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { signPathsInBucket } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { InboxIcon, UploadIcon } from "@/components/nav/icons";
import { DiscardImportButton } from "@/components/import/DiscardImportButton";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

interface ImportRow {
  id: string;
  status: string;
  storage_path: string | null;
  extracted_payload: { title?: string } | null;
  error_message: string | null;
  created_at: string;
}

export default async function InboxPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("imports")
    .select("id, status, storage_path, extracted_payload, error_message, created_at")
    .in("status", ["needs_review", "failed"])
    .order("created_at", { ascending: false });

  const rows = (data as ImportRow[] | null) ?? [];
  const paths = rows
    .map((r) => r.storage_path)
    .filter((p): p is string => Boolean(p));
  const signed = await signPathsInBucket("temp-imports", paths);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Review queue"
        title="Inbox"
        description="Photos Claude has read, waiting for you to review and save."
        actions={
          <Link
            href="/import"
            className={buttonClasses({ variant: "primary" })}
          >
            <UploadIcon className="h-4 w-4" />
            Import photos
          </Link>
        }
      />

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const failed = row.status === "failed";
            const imageUrl = row.storage_path
              ? (signed.get(row.storage_path) ?? null)
              : null;
            const title = row.extracted_payload?.title ?? null;
            return (
              <li key={row.id}>
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {failed
                          ? "Couldn't read this photo"
                          : (title ?? "Untitled recipe")}
                      </p>
                      {failed ? <Badge variant="danger">Failed</Badge> : null}
                    </div>
                    {failed && row.error_message ? (
                      <p className="mt-0.5 truncate text-sm text-foreground-muted">
                        {row.error_message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {!failed ? (
                      <Link
                        href={`/import/${row.id}/review`}
                        className={buttonClasses({
                          variant: "secondary",
                          size: "sm",
                        })}
                      >
                        Review
                      </Link>
                    ) : null}
                    <DiscardImportButton importId={row.id} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<InboxIcon className="h-6 w-6" />}
          title="Nothing to review"
          description="Import some photos and the recipes Claude reads will queue up here."
          action={
            <Link href="/import" className={buttonClasses({ variant: "primary" })}>
              Import photos
            </Link>
          }
        />
      )}
    </div>
  );
}
