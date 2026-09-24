"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊", href: "/" },
  {
    id: "orders",
    label: "Orders",
    icon: "📋",
    href: "/orders",
    children: [
      { id: "orders-new", label: "Create Order", icon: "➕", href: "/orders/new" },
      { id: "orders-all", label: "All Orders", icon: "📑", href: "/orders" },
    ],
  },
  { id: "measurements", label: "Measurements", icon: "📏", href: "/measurements" },
  { id: "reports", label: "Reports", icon: "📈", href: "/reports" },
  { id: "parties", label: "Parties", icon: "👥", href: "/parties" },
  { id: "fabric-parties", label: "Fabric Parties", icon: "🧵", href: "/fabric-parties" },
  { id: "settings", label: "Settings", icon: "⚙️", href: "/settings" },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onItemClick?: () => void;
}

export default function Sidebar({ isCollapsed, onToggle, onItemClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState<string[]>(["orders"]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="flex flex-col w-64 min-h-screen"
      style={{ background: "hsl(var(--sidebar-background))" }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Aahman Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div
              className="font-bold text-xl leading-none text-white"
              style={{
                fontFamily: "Cormorant Garamond, serif",
              }}
            >
              Aahman
            </div>
            <div
              className="text-xs mt-0.5 font-medium"
              style={{ color: "hsl(var(--sidebar-foreground) / 0.65)" }}
            >
              Ethnic Wear ERP
            </div>
          </div>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg border border-white/20 text-white hover:bg-white/10 flex items-center justify-center text-xs transition-colors flex-shrink-0"
            title={isCollapsed ? "Show Sidebar" : "Hide Sidebar (Full Screen)"}
          >
            {isCollapsed ? "▶" : "◀"}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) =>
          item.children ? (
            <div key={item.id}>
              <button
                id={`nav-${item.id}`}
                onClick={() => { toggleGroup(item.id); onItemClick?.(); }}
                className={cn(
                  "sidebar-nav-item w-full justify-between",
                  item.children.some((c) => isActive(c.href)) && "active"
                )}
              >
                <span className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <span
                  className="text-xs transition-transform duration-200"
                  style={{
                    transform: openGroups.includes(item.id)
                      ? "rotate(90deg)"
                      : "none",
                  }}
                >
                  ›
                </span>
              </button>
              {openGroups.includes(item.id) && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
                  {item.children.map((child) => (
                    <Link
                      prefetch={true}
                      key={child.id}
                      id={`nav-${child.id}`}
                      href={child.href}
                      className={cn(
                        "sidebar-nav-item block",
                        isActive(child.href) && child.href !== "/orders"
                          ? "active"
                          : ""
                      )}
                    >
                      <span>{child.icon}</span>
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              prefetch={true}
              key={item.id}
              id={`nav-${item.id}`}
              href={item.href}
              className={cn(
                "sidebar-nav-item flex",
                isActive(item.href) && "active"
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        )}
      </nav>

      {/* Bottom actions */}
      <div
        className="px-3 py-4 border-t space-y-1"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <button
          id="nav-logout"
          onClick={handleLogout}
          className="sidebar-nav-item w-full flex text-red-300 hover:text-red-200"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
