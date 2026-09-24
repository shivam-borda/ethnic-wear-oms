"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function GlobalLoaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reset loader when page finishes loading (pathname/params change)
  useEffect(() => {
    setLoading(false);
    setProgress(100);
    const timer = setTimeout(() => setProgress(0), 300);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    // Intercept clicks on links or navigation items across the whole application
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (target && target.href) {
        try {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(target.href, window.location.href);

          // Trigger loader if navigating within the application to a different URL
          if (
            targetUrl.origin === currentUrl.origin &&
            (targetUrl.pathname !== currentUrl.pathname ||
              targetUrl.search !== currentUrl.search) &&
            !target.getAttribute("target") &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey
          ) {
            setLoading(true);
            setProgress(35);
          }
        } catch {}
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // Increment loader progress smoothly while loading
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + Math.floor(Math.random() * 8) + 4;
        });
      }, 120);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none">
      {/* Top Animated Progress Bar */}
      <div
        className="h-1 bg-gradient-to-r from-red-700 via-orange-500 to-amber-400 transition-all duration-200 ease-out shadow-[0_0_12px_rgba(234,88,12,0.8)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />

      {/* Floating Corner Spinner Badge */}
      {loading && (
        <div className="fixed top-3 right-4 bg-background/95 backdrop-blur border shadow-lg rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-semibold text-foreground animate-in fade-in slide-in-from-top-2 duration-150" style={{ borderColor: "hsl(var(--border))" }}>
          <svg
            className="animate-spin h-4 w-4 text-orange-600 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Loading page...</span>
        </div>
      )}
    </div>
  );
}

export default function GlobalLoader() {
  return (
    <Suspense fallback={null}>
      <GlobalLoaderContent />
    </Suspense>
  );
}
