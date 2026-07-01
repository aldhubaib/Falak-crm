export default function DealDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
        <div className="h-5 w-48 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 @lg:grid-cols-3 gap-6">
        <div className="@lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-full bg-muted/30 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-muted/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 bg-muted/50 rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
