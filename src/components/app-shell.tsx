"use client";

import React from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn("min-h-screen transition-[margin] duration-200 ease-out", sidebarCollapsed ? "md:ml-[68px]" : "md:ml-[240px]")}>
        <TopBar />
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
