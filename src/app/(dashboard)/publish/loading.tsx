export default function PublishLoading() {
  return (
    <div className="flex h-[calc(100vh-48px)]">
      <div className="w-[300px] border-r border-border shrink-0 bg-card/30 p-4 space-y-3">
        <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        <div className="h-8 w-full bg-muted rounded-lg animate-pulse" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
          <div className="h-5 w-36 bg-muted rounded animate-pulse" />
          <div className="h-8 w-20 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 grid grid-cols-7 gap-px bg-border/30 p-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-background min-h-[80px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
