"use client";

import React from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useStore();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "ml-[68px]" : "ml-[240px]"
        )}
      >
        <TopBar />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
