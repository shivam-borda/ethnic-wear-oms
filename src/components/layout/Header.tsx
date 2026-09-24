"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

function getBreadcrumbs(pathname: string) {
  const crumbs = [{ label: "Dashboard", href: "/" }];
  if (pathname === "/") return crumbs;

  const segments = pathname.split("/").filter(Boolean);
  const map: Record<string, string> = {
    orders: "Orders",
    new: "Create Order",
    edit: "Edit Order",
    reports: "Reports",
    parties: "Parties",
    "fabric-parties": "Fabric Parties",
    settings: "Settings",
  };

  segments.forEach((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = map[seg] || (seg.length > 20 ? "Details" : seg.toUpperCase());
    crumbs.push({ label, href });
  });

  return crumbs;
}

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
}

export default function Header({
  isSidebarCollapsed,
  onToggleSidebar,
  onToggleMobileMenu,
}: HeaderProps) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single()
          .then(({ data: prof }) => {
            if (prof) setProfile(prof as Profile);
          });
      }
    });
  }, []);

  const pageTitle = crumbs[crumbs.length - 1]?.label || "Dashboard";

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-card border-b"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      {/* Breadcrumb + Title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg border bg-background hover:bg-muted text-foreground transition-all shadow-sm flex-shrink-0"
            title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar (Full Screen Mode)"}
          >
            <span className="text-sm font-bold">{isSidebarCollapsed ? "📖" : "◀"}</span>
          </button>
        )}

        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg border bg-background hover:bg-muted text-foreground transition-all shadow-sm flex-shrink-0"
            title="Toggle Menu"
          >
            <span className="text-base font-bold">☰</span>
          </button>
        )}

        <div>
        {crumbs.length > 1 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            {crumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i < crumbs.length - 1 ? (
                  <>
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                    <span>›</span>
                  </>
                ) : (
                  <span className="text-foreground font-medium">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1
          className="text-xl font-bold"
          style={{ fontFamily: "Cormorant Garamond, serif" }}
        >
          {pageTitle}
        </h1>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Quick actions */}
        <Link
          href="/orders/new"
          id="header-new-order-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
          style={{
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          <span>+</span>
          <span className="hidden sm:inline">New Order</span>
        </Link>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: "hsl(var(--primary) / 0.15)",
              color: "hsl(var(--primary))",
            }}
          >
            {profile?.full_name
              ? profile.full_name.slice(0, 2).toUpperCase()
              : "?"}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium leading-none">
              {profile?.full_name || "User"}
            </div>
            <div className="text-xs text-muted-foreground capitalize mt-0.5">
              {profile?.role || "staff"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
