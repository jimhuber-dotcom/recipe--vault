import type { ComponentType } from "react";
import {
  HomeIcon,
  BookIcon,
  HeartIcon,
  FolderIcon,
  InboxIcon,
  UploadIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

/** Primary destinations shown in the desktop sidebar. */
export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: HomeIcon },
  { label: "Library", href: "/library", icon: BookIcon },
  { label: "Favorites", href: "/favorites", icon: HeartIcon },
  { label: "Collections", href: "/collections", icon: FolderIcon },
  { label: "Inbox", href: "/inbox", icon: InboxIcon },
  { label: "Import", href: "/import", icon: UploadIcon },
  { label: "Search", href: "/search", icon: SearchIcon },
];

export const settingsNavItem: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: SettingsIcon,
};

/** Condensed set for the mobile bottom bar (five slots). */
export const bottomNav: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Library", href: "/library", icon: BookIcon },
  { label: "Import", href: "/import", icon: UploadIcon },
  { label: "Search", href: "/search", icon: SearchIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

/** Active-route test shared by both navs. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
