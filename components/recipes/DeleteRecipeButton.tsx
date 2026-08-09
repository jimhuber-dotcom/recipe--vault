"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecipe } from "@/app/(app)/recipes/actions";
import { Button } from "@/components/ui/Button";

export function DeleteRecipeButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deleteRecipe(id);
      if (!res.error) {
        router.push("/library");
        router.refresh();
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-foreground-muted">Delete this recipe?</span>
      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Cancel
      </Button>
    </span>
  );
}
