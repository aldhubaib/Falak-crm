export default function InvoiceDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
        <div className="h-5 w-36 bg-muted rounded animate-pulse" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="border-t border-border pt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-40 bg-muted/50 rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
