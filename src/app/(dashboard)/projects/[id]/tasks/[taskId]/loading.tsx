export default function TaskDetailLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh)]">
      <div className="px-4 @sm:px-6 py-3 border-b border-border flex items-center gap-3">
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
        <div className="h-5 w-56 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex-1 flex flex-col @lg:flex-row">
        <div className="flex-1 p-4 @sm:p-6 space-y-6">
          <div className="space-y-3">
            <div className="h-6 w-64 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-5 h-5 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-3 w-48 bg-muted/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="w-full @lg:w-[300px] border-t @lg:border-t-0 @lg:border-l border-border p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 bg-muted/50 rounded animate-pulse" />
              <div className="h-8 w-full bg-muted/30 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
