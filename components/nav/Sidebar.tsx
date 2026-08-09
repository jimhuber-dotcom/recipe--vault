"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { primaryNav, settingsNavItem, isActivePath } from "./nav-items";
import { SignOutButton } from "@/components/auth/SignOutButton";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3v7a3 3 0 0 0 6 0V3" />
            <path d="M9 10v11" />
            <path d="M18 3c-1.5 0-3 1.8-3 5s1.5 4 3 4" />
            <path d="M18 3v18" />
          </svg>
        </span>
        <span className="font-display text-lg text-foreground">
          Recipe Vault
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActivePath(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="space-y-3 border-t border-border px-3 py-4">
        <NavLink
          item={settingsNavItem}
          active={isActivePath(pathname, settingsNavItem.href)}
        />
        <div className="px-1">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
}: {
  item: (typeof primaryNav)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {item.label}
    </Link>
  );
}
