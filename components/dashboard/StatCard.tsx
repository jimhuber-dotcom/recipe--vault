import Link from "next/link";
import { Card } from "@/components/ui/Card";

export interface StatCardProps {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
}

export function StatCard({ label, value, href, icon }: StatCardProps) {
  return (
    <Link href={href} className="block">
      <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-display text-2xl leading-none text-foreground">
            {value.toLocaleString()}
          </div>
          <div className="mt-1 truncate text-sm text-foreground-muted">
            {label}
          </div>
        </div>
      </Card>
    </Link>
  );
}
