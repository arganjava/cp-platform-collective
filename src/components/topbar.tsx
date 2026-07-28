"use client";

import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { usePathname } from "next/navigation";
import { cn, getInitials, getRelativeTime } from "@/lib/utils";
import {
  Search,
  Bell,
  ChevronDown,
  Check,
  X,
  User,
  LogOut,
  Settings,
} from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/tasks": "My Tasks",
  "/gantt": "Timeline",
  "/sales": "Sales",
  "/reports": "Reports",
};

export function TopBar() {
  const pathname = usePathname();
  const {
    searchQuery,
    setSearchQuery,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    currentUserId,
    getUserById,
  } = useStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = getUnreadCount();
  const currentUser = getUserById(currentUserId);
  const userNotifications = notifications.filter((n) => n.userId === currentUserId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifTypeIcons: Record<string, string> = {
    assignment: "📋",
    mention: "💬",
    deadline: "⏰",
    update: "🔔",
    comment: "💬",
  };

  return (
    <header className="h-16 bg-white border-b border-border-default flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Page title */}
      <h2 className="text-lg font-bold text-text-primary font-[family-name:var(--font-heading)] tracking-tight">
        {pageTitles[pathname] || "CP Platform"}
      </h2>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search tasks, projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 h-9 pl-9 pr-4 rounded-[10px] border border-border-default bg-surface text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cp-purple-500 focus:ring-offset-1 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted bg-surface-sunken px-1.5 py-0.5 rounded font-mono">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex items-center justify-center w-9 h-9 rounded-[10px] hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px] text-text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4.5 h-4.5 min-w-[18px] text-[10px] font-bold text-white bg-cp-coral-500 rounded-full notification-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-[380px] bg-white rounded-[14px] border border-border-default shadow-xl overflow-hidden animate-slide-down">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-cp-purple-600 hover:text-cp-purple-700 font-medium cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {userNotifications.length === 0 ? (
                  <div className="py-8 text-center text-text-muted text-sm">No notifications</div>
                ) : (
                  userNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors cursor-pointer border-b border-border-default/50 last:border-0",
                        !notif.isRead && "bg-cp-purple-50/50"
                      )}
                      onClick={() => markNotificationRead(notif.id)}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{notifTypeIcons[notif.type] || "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm leading-snug", !notif.isRead ? "font-medium text-text-primary" : "text-text-secondary")}>
                          {notif.message}
                        </p>
                        <span className="text-xs text-text-muted mt-1 block">{getRelativeTime(notif.createdAt)}</span>
                      </div>
                      {!notif.isRead && (
                        <div className="w-2 h-2 rounded-full bg-cp-purple-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 py-1.5 px-2 rounded-[10px] hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: currentUser?.avatarColor || "#8b46ff" }}
            >
              {currentUser ? getInitials(currentUser.name) : "?"}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-text-primary leading-tight">{currentUser?.name || "User"}</p>
              <p className="text-[10px] text-text-muted leading-tight capitalize">{currentUser?.role || "member"}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-[14px] border border-border-default shadow-xl overflow-hidden animate-slide-down">
              <div className="px-4 py-3 border-b border-border-default">
                <p className="font-semibold text-sm">{currentUser?.name}</p>
                <p className="text-xs text-text-muted">{currentUser?.email}</p>
              </div>
              <div className="py-1">
                <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-surface-sunken transition-colors cursor-pointer">
                  <User className="w-4 h-4" /> Profile
                </button>
                <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-surface-sunken transition-colors cursor-pointer">
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <div className="border-t border-border-default my-1" />
                <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-cp-coral-600 hover:bg-cp-coral-50 transition-colors cursor-pointer">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
