export default function OrdersLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Search & Filters Toolbar Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 flex-1 min-w-48 bg-muted rounded-lg" />
        <div className="h-10 w-44 bg-muted rounded-lg" />
        <div className="h-10 w-44 bg-muted rounded-lg" />
        <div className="h-10 w-32 bg-primary/20 rounded-lg" />
      </div>

      {/* Cards View Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between h-64"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="h-5 w-24 bg-primary/20 rounded" />
                <div className="h-5 w-16 bg-muted rounded-full" />
              </div>
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="grid grid-cols-2 gap-2 pt-3">
                <div className="h-14 bg-muted/40 rounded-lg" />
                <div className="h-14 bg-muted/40 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <div className="h-8 flex-1 bg-muted rounded-lg" />
              <div className="h-8 flex-1 bg-muted rounded-lg" />
              <div className="h-8 flex-1 bg-primary/20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
