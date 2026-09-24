export default function MeasurementsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-72 bg-muted rounded-lg" />
          <div className="h-4 w-96 bg-muted rounded-lg mt-2" />
        </div>
        <div className="h-10 w-52 bg-muted rounded-lg" />
      </div>

      {/* Search Input Skeleton */}
      <div className="h-11 w-full bg-muted/60 rounded-xl border" />

      {/* Grid of Card Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between h-64"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="h-5 w-24 bg-blue-100 dark:bg-blue-950 rounded-md" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="grid grid-cols-2 gap-2 pt-3">
                <div className="h-16 bg-muted/40 rounded-lg" />
                <div className="h-16 bg-muted/40 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <div className="h-9 flex-1 bg-muted rounded-lg" />
              <div className="h-9 flex-1 bg-primary/20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
