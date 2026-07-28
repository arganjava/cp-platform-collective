"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  GanttChart,
  DollarSign,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/gantt", label: "Gantt", icon: GanttChart },
  { href: "/sales", label: "Sales", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar-bg flex flex-col transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cp-purple-500 to-cp-coral-500 flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-white font-bold text-sm tracking-tight leading-tight font-[family-name:var(--font-heading)]">
              CP Platform
            </h1>
            <p className="text-[10px] text-white/50 leading-tight">Collective Perspectives</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-sidebar-active text-sidebar-text-active"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-cp-purple-400 rounded-r-full" />
              )}
              <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", isActive && "text-cp-purple-400")} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full py-2 rounded-lg text-white/50 hover:text-white hover:bg-sidebar-hover transition-colors cursor-pointer"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
