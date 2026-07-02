export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh)]">
      <div className="px-4 @md:px-6 py-3 border-b border-border flex items-center gap-3">
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
        <div className="h-5 w-48 bg-muted rounded animate-pulse" />
      </div>
      <div className="px-4 @md:px-6 py-2 border-b border-border flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3.5 w-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="flex-1 p-4 @md:p-6">
        <div className="flex flex-col @md:flex-row gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 min-w-[200px] space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="rounded-lg bg-muted/20 p-2 space-y-2 min-h-[200px]">
                <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
