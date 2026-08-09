"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { SearchIcon } from "@/components/nav/icons";

/**
 * Routes to /search on submit. No search logic yet — that screen is a stub.
 */
export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <form onSubmit={handleSubmit} className="relative" role="search">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-muted" />
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search recipes, ingredients, notes…"
        aria-label="Search recipes"
        className="pl-11"
      />
    </form>
  );
}
