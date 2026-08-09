import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Plain form post to the sign-out route handler — no client JS required.
 */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={cn(className)}>
      <button
        type="submit"
        className={buttonClasses({ variant: "secondary", size: "sm" })}
      >
        Sign out
      </button>
    </form>
  );
}
