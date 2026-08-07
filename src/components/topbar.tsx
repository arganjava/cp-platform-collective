"use client";

import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { usePathname } from "next/navigation";
import { cn, getInitials, getRelativeTime } from "@/lib/utils";
import { Search, Bell, ChevronDown, User, LogOut, Settings, ClipboardList, MessageCircle, Clock3, Info } from "lucide-react";

const pageTitles: Record<string, string> = { "/": "Dashboard", "/projects": "Projects", "/tasks": "My Tasks", "/gantt": "Timeline", "/sales": "Sales", "/reports": "Reports" };

export function TopBar() {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery, notifications, markNotificationRead, markAllNotificationsRead, getUnreadCount, currentUserId, getUserById } = useStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = getUnreadCount();
  const currentUser = getUserById(currentUserId);
  const userNotifications = notifications.filter((n) => n.userId === currentUserId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    assignment: ClipboardList,
    mention: MessageCircle,
    deadline: Clock3,
    update: Info,
    comment: MessageCircle,
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-border bg-card px-4 pl-16 sm:gap-3 sm:px-6 md:pl-6">
      <div className="min-w-0 md:hidden">
        <p className="truncate font-heading text-sm font-bold text-foreground">{pageTitles[pathname] || "CP Platform"}</p>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search tasks and projects"
            placeholder="Search tasks, projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-48 border border-border bg-background px-9 pr-12 text-sm text-foreground placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 lg:w-64"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-subtle-foreground lg:block">⌘K</kbd>
        </div>

        <div className="relative" ref={notifRef}>
          <button type="button" aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`} aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)} className="relative flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 bg-brand" />}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-14 w-[min(380px,calc(100vw-2rem))] overflow-hidden border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-heading text-base font-semibold">Notifications</h2>
                {unreadCount > 0 && <button type="button" onClick={markAllNotificationsRead} className="min-h-10 text-sm font-semibold text-destructive hover:underline">Mark all read</button>}
              </div>
              <div className="max-h-[min(400px,60vh)] overflow-y-auto">
                {userNotifications.length === 0 ? <div className="px-4 py-10 text-center text-sm text-subtle-foreground">No notifications</div> : userNotifications.map((notif) => {
                  const Icon = notifTypeIcons[notif.type] || Info;
                  return (
                    <button type="button" key={notif.id} onClick={() => markNotificationRead(notif.id)} className={cn("flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary", !notif.isRead && "bg-accent")}>
                      <span className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center", notif.isRead ? "bg-secondary text-subtle-foreground" : "bg-accent text-destructive")}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><span className={cn("block text-sm leading-relaxed", !notif.isRead ? "font-semibold text-foreground" : "text-muted-foreground")}>{notif.message}</span><span className="mt-1 block text-xs text-subtle-foreground">{getRelativeTime(notif.createdAt)}</span></span>
                      {!notif.isRead && <span className="mt-2 h-2 w-2 flex-shrink-0 bg-brand" aria-label="Unread" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button type="button" aria-label="Open profile menu" aria-expanded={showProfile} onClick={() => setShowProfile(!showProfile)} className="flex min-h-11 items-center gap-2 px-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white" style={{ backgroundColor: currentUser?.avatarColor || "var(--primary)" }}>{currentUser ? getInitials(currentUser.name) : "?"}</span>
            <span className="hidden text-left sm:block"><span className="block text-sm font-semibold leading-tight text-foreground">{currentUser?.name || "User"}</span><span className="block text-xs capitalize leading-tight text-subtle-foreground">{currentUser?.role || "member"}</span></span>
            <ChevronDown className="h-4 w-4 text-subtle-foreground" aria-hidden="true" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-14 w-56 overflow-hidden border border-border bg-card shadow-lg">
              <div className="border-b border-border px-4 py-3"><p className="font-semibold text-sm">{currentUser?.name}</p><p className="text-xs text-subtle-foreground">{currentUser?.email}</p></div>
              <div className="p-1"><button type="button" className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"><User className="h-4 w-4" aria-hidden="true" /> Profile</button><button type="button" className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"><Settings className="h-4 w-4" aria-hidden="true" /> Settings</button><div className="my-1 border-t border-border" /><button type="button" className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</button></div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
