import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Prev/Next pager for server-rendered list pages driven by a ?page= param.
export function ListPager({
  basePath,
  page,
  hasMore,
}: {
  basePath: string;
  page: number;
  hasMore: boolean;
}) {
  if (page <= 1 && !hasMore) return null;

  const href = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);

  return (
    <div className="flex items-center justify-between pt-2">
      {page > 1 ? (
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link href={href(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-xs text-muted-foreground">Page {page}</span>
      {hasMore ? (
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link href={href(page + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}
