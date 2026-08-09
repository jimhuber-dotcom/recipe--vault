"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { bottomNav, isActivePath } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-foreground-muted hover:text-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
