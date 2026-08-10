"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardImport } from "@/app/(app)/import/actions";

export function DiscardImportButton({ importId }: { importId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await discardImport(importId);
          router.refresh();
        })
      }
      className="text-sm font-medium text-foreground-muted hover:text-danger disabled:opacity-60"
    >
      {pending ? "Removing…" : "Discard"}
    </button>
  );
}
