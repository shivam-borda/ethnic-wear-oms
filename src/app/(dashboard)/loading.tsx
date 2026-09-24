export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse p-2">
      {/* Top progress bar animation */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-800 via-orange-500 to-amber-400 z-50 animate-pulse" />

      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-2">
        <div className="h-8 w-48 bg-muted/60 rounded-lg" />
        <div className="h-10 w-32 bg-muted/60 rounded-lg" />
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl border bg-card/60 p-4 flex flex-col justify-between shadow-sm"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted/70 rounded" />
              <div className="h-8 w-8 bg-muted/70 rounded-lg" />
            </div>
            <div className="h-8 w-16 bg-muted/80 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Table / Content Area Skeleton */}
      <div
        className="rounded-xl border bg-card/60 p-6 space-y-4 shadow-sm min-h-[350px]"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="h-6 w-36 bg-muted/70 rounded" />
          <div className="h-8 w-48 bg-muted/70 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 5, 6].map((i) => (
            <div key={i} className="h-12 w-full bg-muted/50 rounded-lg flex items-center px-4 justify-between">
              <div className="h-4 w-28 bg-muted/70 rounded" />
              <div className="h-4 w-36 bg-muted/70 rounded" />
              <div className="h-4 w-20 bg-muted/70 rounded" />
              <div className="h-6 w-16 bg-muted/70 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
