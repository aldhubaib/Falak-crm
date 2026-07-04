// Route-level loading boundary: navigation inside the dashboard commits
// immediately and shows this spinner while the next page's server render
// streams in (instead of the old page appearing frozen).
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
