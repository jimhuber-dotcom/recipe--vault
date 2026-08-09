"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { HeartIcon } from "@/components/nav/icons";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title A–Z" },
  { value: "most_cooked", label: "Most cooked" },
];

export function LibraryControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sort = params.get("sort") ?? "newest";
  const fav = params.get("fav") === "1";

  function update(next: { sort?: string; fav?: boolean }) {
    const sp = new URLSearchParams(params.toString());
    if (next.sort !== undefined) sp.set("sort", next.sort);
    if (next.fav !== undefined) {
      if (next.fav) sp.set("fav", "1");
      else sp.delete("fav");
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => update({ fav: !fav })}
        aria-pressed={fav}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
          fav
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface text-foreground hover:bg-surface-muted",
        )}
      >
        <HeartIcon className="h-4 w-4" />
        Favorites
      </button>
      <label className="ml-auto flex items-center gap-2 text-sm text-foreground-muted">
        Sort
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
