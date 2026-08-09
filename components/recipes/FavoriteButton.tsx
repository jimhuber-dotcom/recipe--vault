"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/(app)/recipes/actions";
import { HeartIcon } from "@/components/nav/icons";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  id,
  initial,
}: {
  id: string;
  initial: boolean;
}) {
  const [fav, setFav] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !fav;
    setFav(next); // optimistic
    startTransition(async () => {
      const res = await toggleFavorite(id, next);
      if (res.error) setFav(!next); // revert on failure
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={fav}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors disabled:opacity-60",
        fav
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-foreground hover:bg-surface-muted",
      )}
    >
      <HeartIcon className="h-4 w-4" />
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}
