"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/data";
import { cn, getInitials } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Upload,
  Check,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const AVATAR_COLORS = [
  "var(--primary)",
  "var(--brand)",
  "var(--destructive)",
  "var(--muted-foreground)",
  "var(--subtle-foreground)",
];

export function UserMenu() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { currentUserId, getUserById, updateUser, reset, notifications, markAllNotificationsRead, users, projects, tasks } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState("var(--primary)");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const currentUser = getUserById(currentUserId);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Sync the profile form whenever the dialog opens.
  useEffect(() => {
    if (profileOpen && currentUser) {
      setName(currentUser.name);
      setAvatarColor(currentUser.avatarColor || "var(--primary)");
      setAvatarUrl(currentUser.avatarUrl);
      setError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordError(null);
      setPasswordSuccess(null);
    }
  }, [profileOpen, currentUser]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Continue with local sign-out even if the network call fails.
    }
    reset();
    router.push("/login");
    router.refresh();
  }

  function handleSaveProfile() {
    if (!currentUser || !name.trim()) return;
    setSaving(true);
    setError(null);
    updateUser(currentUser.id, {
      name: name.trim(),
      avatarColor,
      avatarUrl,
    });
    setSaving(false);
    setProfileOpen(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(currentUser.id, file);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the avatar photo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleChangePassword(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!currentUser?.email) {
      setPasswordError("User email not found.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be the same as your current password.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const supabase = getSupabase();

      // 1. Verify current password by authenticating against Supabase
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (signInErr) {
        setPasswordError("Current password is incorrect. Please try again.");
        setPasswordSaving(false);
        return;
      }

      // 2. Update password in Supabase
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        setPasswordError(updateErr.message || "Failed to update password.");
        setPasswordSaving(false);
        return;
      }

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Open profile menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex min-h-11 items-center gap-2 px-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2"
      >
        <Avatar color={currentUser?.avatarColor || "var(--primary)"} size="lg" className="h-9 w-9 text-xs">
          {currentUser?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUser.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            currentUser ? getInitials(currentUser.name) : "?"
          )}
        </Avatar>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-foreground">{currentUser?.name || "User"}</span>
          <span className="block text-xs capitalize leading-tight text-subtle-foreground">{currentUser?.role || "guest"}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-subtle-foreground" aria-hidden="true" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-14 w-56 overflow-hidden border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{currentUser?.name}</p>
            <p className="text-xs text-subtle-foreground">{currentUser?.email}</p>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setProfileOpen(true);
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              <User className="h-4 w-4" aria-hidden="true" /> Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Settings
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Profile dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>Your details across the CP workspace.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-5">
            <div className="flex items-center gap-4">
              <Avatar color={avatarColor} size="lg" className="h-14 w-14 text-base">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(name || currentUser?.name || "?")
                )}
              </Avatar>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" aria-hidden="true" /> {uploading ? "Uploading…" : "Upload photo"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                {avatarUrl && (
                  <button type="button" onClick={() => setAvatarUrl(undefined)} className="mt-1 block text-sm text-destructive hover:underline">
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium">Name</label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <p className="flex h-10 items-center truncate border border-border bg-secondary px-3 text-sm text-muted-foreground">{currentUser?.email || "—"}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Role</label>
                <p className="flex h-10 items-center border border-border bg-secondary px-3 text-sm capitalize text-muted-foreground">{currentUser?.role || "guest"}</p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Avatar colour</label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use avatar colour ${color}`}
                    aria-pressed={avatarColor === color}
                    onClick={() => setAvatarColor(color)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      avatarColor === color ? "border-primary ring-2 ring-ring ring-offset-2 ring-offset-background" : "border-border hover:border-input"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {avatarColor === color && <Check className="h-4 w-4 text-primary-foreground" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Change Password Section */}
            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4 text-foreground" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Update your account password using your current credentials with Supabase.
              </p>

              <div className="space-y-3">
                {/* Current Password */}
                <div>
                  <label htmlFor="profile-current-password" className="mb-1.5 block text-xs font-medium text-foreground">
                    Current password
                  </label>
                  <div className="relative">
                    <Input
                      id="profile-current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
                      placeholder="Enter current password"
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      id="toggle-current-password-visibility"
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label htmlFor="profile-new-password" className="mb-1.5 block text-xs font-medium text-foreground">
                    New password
                  </label>
                  <div className="relative">
                    <Input
                      id="profile-new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
                      placeholder="Minimum 6 characters"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      id="toggle-new-password-visibility"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="profile-confirm-password" className="mb-1.5 block text-xs font-medium text-foreground">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Input
                      id="profile-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
                      placeholder="Re-enter new password"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      id="toggle-confirm-password-visibility"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Feedback */}
                {passwordError && (
                  <div className="flex items-start gap-2 border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="flex items-start gap-2 border border-brand/20 bg-brand/10 p-2.5 text-xs text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden="true" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    id="update-password-btn"
                    variant="outline"
                    size="sm"
                    onClick={() => handleChangePassword()}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {passwordSaving ? "Updating password…" : "Update password"}
                  </Button>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveProfile} disabled={saving || !name.trim()}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Workspace and account preferences.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-6">
            <div>
              <h3 className="text-sm font-semibold">Workspace</h3>
              <dl className="mt-2 divide-y divide-border border-y border-border text-sm">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Workspace</dt>
                  <dd className="font-medium">CP Platform</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Team members</dt>
                  <dd className="font-medium tabular">{users.length}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Projects</dt>
                  <dd className="font-medium tabular">{projects.length}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted-foreground">Tasks</dt>
                  <dd className="font-medium tabular">{tasks.length}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Appearance</h3>
              <div className="mt-2 flex items-center justify-between gap-3 border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-subtle-foreground">Follows your system unless you choose otherwise.</p>
                </div>
                <Select
                  aria-label="Theme preference"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="w-32 flex-shrink-0"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="mt-2 flex items-center justify-between gap-3 border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Unread notifications</p>
                  <p className="text-xs text-subtle-foreground">{unreadCount} awaiting review</p>
                </div>
                <Button variant="outline" size="sm" onClick={markAllNotificationsRead} disabled={unreadCount === 0}>
                  Mark all read
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Account</h3>
              <div className="mt-2 flex items-center justify-between gap-3 border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Signed in as</p>
                  <p className="truncate text-xs text-subtle-foreground">{currentUser?.email || "—"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
