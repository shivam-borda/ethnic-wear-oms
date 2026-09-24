"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Restore sidebar state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen((prev) => !prev);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar (Collapsible) */}
      <div
        className={`hidden lg:block transition-all duration-300 ease-in-out flex-shrink-0 z-30 ${
          isCollapsed ? "w-0 opacity-0 pointer-events-none overflow-hidden" : "w-64 opacity-100"
        }`}
      >
        <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile Drawer Navigation (Hidden by default on mobile) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-in fade-in duration-200">
          {/* Dark Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Sliding Drawer */}
          <div className="relative w-64 max-w-[80vw] bg-[hsl(var(--sidebar-background))] min-h-screen flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              isCollapsed={false}
              onToggle={() => setIsMobileOpen(false)}
              onItemClick={() => setIsMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header
          isSidebarCollapsed={isCollapsed}
          onToggleSidebar={toggleSidebar}
          onToggleMobileMenu={toggleMobileMenu}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
