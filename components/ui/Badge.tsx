import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "primary" | "accent" | "success" | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-foreground-muted",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
