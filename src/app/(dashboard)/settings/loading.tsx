export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-5 w-24 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
