export default function InvoicesLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="h-8 w-28 bg-muted rounded-full animate-pulse" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/30 px-4 py-2.5 flex gap-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 w-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-t border-border px-4 py-3 flex items-center gap-8">
            <div className="h-3.5 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3.5 w-32 bg-muted/50 rounded animate-pulse" />
            <div className="h-3.5 w-16 bg-muted/50 rounded animate-pulse" />
            <div className="h-3.5 w-20 bg-muted/50 rounded animate-pulse" />
            <div className="h-5 w-16 bg-muted/50 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
