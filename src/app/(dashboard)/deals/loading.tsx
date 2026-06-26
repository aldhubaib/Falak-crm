export default function DealsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 bg-muted rounded animate-pulse" />
        <div className="h-8 w-28 bg-muted rounded-full animate-pulse" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[200px] space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="rounded-lg bg-muted/30 p-2 space-y-2 min-h-[200px]">
              <div className="rounded-xl border border-border bg-card p-4 h-24 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
