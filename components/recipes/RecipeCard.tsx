import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { HeartIcon, BookIcon, ClockIcon } from "@/components/nav/icons";
import type { RecipeListItem } from "@/lib/recipes";

export function RecipeCard({
  item,
  imageUrl,
}: {
  item: RecipeListItem;
  imageUrl: string | null;
}) {
  return (
    <Link href={`/recipes/${item.id}`} className="block">
      <Card className="overflow-hidden transition-shadow hover:shadow-card-hover">
        <div className="relative aspect-[4/3] bg-surface-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-foreground-muted">
              <BookIcon className="h-8 w-8" />
            </div>
          )}
          {item.is_favorite ? (
            <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-accent shadow-card">
              <HeartIcon className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <div className="p-4">
          <div className="font-mono text-xs text-foreground-muted">
            {item.recipe_code}
          </div>
          <h3 className="mt-1 line-clamp-1 font-display text-base text-foreground">
            {item.title}
          </h3>
          {item.subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-foreground-muted">
              {item.subtitle}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            {item.main_protein ? (
              <Badge variant="neutral">{item.main_protein}</Badge>
            ) : null}
            {item.total_minutes ? (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {item.total_minutes}m
              </span>
            ) : null}
            {item.difficulty ? (
              <span className="capitalize">{item.difficulty}</span>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
