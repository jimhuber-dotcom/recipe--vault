/**
 * Minimal className joiner. We deliberately avoid a dependency (clsx /
 * tailwind-merge) — the design system is small enough that filtering falsy
 * values is all we need.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
