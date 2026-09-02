"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Menu, LayoutDashboard, FolderKanban, CheckSquare, GanttChart, DollarSign, BarChart3, Users, ChevronLeft, ChevronRight, X } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sheet: string;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, sheet: "01" },
  { href: "/projects", label: "Projects", icon: FolderKanban, sheet: "02" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, sheet: "03" },
  { href: "/gantt", label: "Timeline", icon: GanttChart, sheet: "04" },
  { href: "/sales", label: "Sales", icon: DollarSign, sheet: "05", adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3, sheet: "06" },
  { href: "/users", label: "Users", icon: Users, sheet: "07", adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const currentUserId = useStore((s) => s.currentUserId);
  const getUserById = useStore((s) => s.getUserById);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentUser = getUserById(currentUserId);
  const isGuest = currentUser?.role === "guest";

  const visibleNavItems = allNavItems.filter((item) => {
    if (isGuest && item.adminOnly) return false;
    return true;
  });

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-11 w-11 items-center justify-center bg-primary text-primary-foreground shadow-md md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {mobileOpen && (
        <button type="button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-scrim/45 md:hidden" />
      )}

      <aside
        aria-label="Primary navigation"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar transition-[width,transform] duration-200 ease-out",
          "w-[240px] md:translate-x-0",
          sidebarCollapsed ? "md:w-[68px]" : "md:w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-brand text-white" aria-hidden="true">
            <span className="font-heading text-lg font-bold">CP</span>
          </div>
          {(!sidebarCollapsed || mobileOpen) && (
            <div className="min-w-0 overflow-hidden">
              <p className="font-heading text-sm font-bold leading-tight text-white">CP Platform</p>
              <p className="text-xs leading-tight text-sidebar-foreground">Collective Perspectives</p>
            </div>
          )}
          <button type="button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} className="ml-auto flex h-10 w-10 items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-white md:hidden">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                )}
              >
                {isActive && <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 bg-sidebar-primary" aria-hidden="true" />}
                <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-white" : "text-sidebar-foreground")} aria-hidden="true" />
                {(!sidebarCollapsed || mobileOpen) && (
                  <span className="flex flex-1 items-center justify-between">
                    <span>{item.label}</span>
                    <span className={cn("font-mono text-[10px] tracking-wider", isActive ? "text-sidebar-active" : "text-sidebar-foreground/60")}>{item.sheet}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"} className="flex min-h-11 w-full items-center justify-center text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white">
            {sidebarCollapsed ? <ChevronRight className="h-5 w-5" aria-hidden="true" /> : <span className="flex items-center gap-2 text-sm"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
