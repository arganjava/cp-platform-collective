"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { updateProfileRow } from "@/lib/supabase/data";
import { cn, getInitials, formatDate, generateId } from "@/lib/utils";
import type { User, UserRole } from "@/lib/types";
import { validateEmailForRole } from "@/lib/supabase/email-policy";
import { PageFrame, PageHeader, SheetSummary, SummaryMetric, Toolbar } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  UserCheck,
  UserX,
  Shield,
  ShieldAlert,
  ArrowLeft,
  User as UserIcon,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Lock,
  Check,
  AlertTriangle,
} from "lucide-react";

const AVATAR_COLORS = [
  "var(--primary)",
  "var(--brand)",
  "var(--destructive)",
  "var(--muted-foreground)",
  "var(--subtle-foreground)",
];

export default function UsersPage() {
  const {
    users,
    currentUserId,
    getUserById,
    addUser,
    updateUser,
    softDeleteUser,
    restoreUser,
    searchQuery: globalSearchQuery,
    lastError,
    clearError,
  } = useStore();

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";

  const [localSearch, setLocalSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted" | "all">("active");

  // Create User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "member" as UserRole,
    password: "",
    avatarColor: "var(--primary)",
  });

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    role: UserRole;
    avatarColor: string;
  }>({
    name: "",
    role: "member",
    avatarColor: "var(--primary)",
  });

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const query = (localSearch || globalSearchQuery).trim().toLowerCase();

  const filteredUsers = users
    .filter((u) => {
      if (statusFilter === "active" && u.isDeleted) return false;
      if (statusFilter === "deleted" && !u.isDeleted) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (query) {
        const haystack = `${u.name} ${u.email} ${u.role}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort active first, then admins, members, guests, then by name
      if (Boolean(a.isDeleted) !== Boolean(b.isDeleted)) return a.isDeleted ? 1 : -1;
      if (a.role !== b.role) {
        const order: Record<UserRole, number> = { admin: 0, member: 1, guest: 2 };
        return order[a.role] - order[b.role];
      }
      return a.name.localeCompare(b.name);
    });

  const totalUsers = users.length;
  const activeCount = users.filter((u) => !u.isDeleted).length;
  const adminCount = users.filter((u) => !u.isDeleted && u.role === "admin").length;
  const memberCount = users.filter((u) => !u.isDeleted && u.role === "member").length;
  const guestCount = users.filter((u) => !u.isDeleted && u.role === "guest").length;
  const deletedCount = users.filter((u) => u.isDeleted).length;

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const password = newUser.password;

    if (!name) {
      setFormError("Please enter the user's full name.");
      return;
    }
    if (!email || !email.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }

    const emailCheck = validateEmailForRole(email, newUser.role);
    if (!emailCheck.valid) {
      setFormError(emailCheck.error || "Invalid email address for selected role.");
      return;
    }

    if (!password || password.length < 6) {
      setFormError("Initial password must be at least 6 characters.");
      return;
    }

    const existing = users.find((u) => u.email.trim().toLowerCase() === email);
    if (existing) {
      if (existing.isDeleted) {
        setFormError("A user profile with this email address already exists in the archive. Please restore it or use another email.");
      } else {
        setFormError("A user profile with this email address already exists.");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const userPayload: User = {
        id: generateId(),
        name,
        email,
        role: newUser.role,
        avatarColor: newUser.avatarColor,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };

      await addUser(userPayload, password);

      setNewUser({
        name: "",
        email: "",
        role: "member",
        password: "",
        avatarColor: "var(--primary)",
      });
      setShowAddModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenEdit(user: User) {
    setEditingUserId(user.id);
    setEditError(null);
    setIsSavingEdit(false);
    setEditForm({
      name: user.name,
      role: user.role,
      avatarColor: user.avatarColor || "var(--primary)",
    });
  }

  async function handleSaveEdit() {
    if (!editingUserId || !editForm.name.trim()) return;
    setEditError(null);
    const targetUser = users.find((u) => u.id === editingUserId);
    if (!targetUser) return;

    const emailDomain = targetUser.email.split("@").pop()?.toLowerCase();
    const hasCollectiveEmail = emailDomain === "collectivep.com";

    // Strict domain check: Non-@collectivep.com accounts CANNOT be made Admin
    if (editForm.role === "admin" && !hasCollectiveEmail) {
      setEditError("Accounts with non-@collectivep.com emails cannot be assigned the Admin role. The Admin role requires an email address with the @collectivep.com domain.");
      return;
    }

    if (editForm.role === "member" && !hasCollectiveEmail) {
      setEditError("Accounts with non-@collectivep.com emails cannot be assigned the Member role. The Member role requires an email address with the @collectivep.com domain.");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateProfileRow(editingUserId, {
        name: editForm.name.trim(),
        role: editForm.role,
        avatarColor: editForm.avatarColor,
      });

      // Update local store immediately
      updateUser(editingUserId, {
        name: editForm.name.trim(),
        role: editForm.role,
        avatarColor: editForm.avatarColor,
      });

      setEditingUserId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update team member details.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function handleConfirmSoftDelete() {
    if (!deletingUser) return;
    softDeleteUser(deletingUser.id);
    setDeletingUser(null);
  }

  if (!isAdmin) {
    const roleLabel = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "Guest";
    return (
      <PageFrame id="users-access-denied-frame">
        <PageHeader
          title="Team & Users"
          description="Manage workspace team members, credentials, and roles."
        />
        <Card className="border border-border p-8 text-center" id="card-users-restricted">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Access Restricted
          </h2>
          <p className="max-w-md mx-auto text-sm text-muted-foreground mb-6">
            Your current role is set to <strong>{roleLabel}</strong>. User directory administration and credential management are strictly restricted to Workspace Administrators.
          </p>
          <div className="flex justify-center">
            <Link href="/">
              <Button variant="default" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Dashboard</span>
              </Button>
            </Link>
          </div>
        </Card>
      </PageFrame>
    );
  }

  return (
    <PageFrame id="users-page-container">
      <PageHeader
        title="Team & Users"
        description="Manage workspace team members, credentials, and roles. Roles are strictly partitioned into Admin (full access) and Guest (restricted from Sales)."
        actions={
          isAdmin ? (
            <Button
              id="btn-add-user-top"
              type="button"
              onClick={() => {
                setFormError(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add User</span>
            </Button>
          ) : null
        }
      />

      {lastError && (
        <div className="flex items-center justify-between border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{lastError}</span>
          </div>
          <button type="button" onClick={clearError} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Summary */}
      <SheetSummary id="users-metric-summary">
        <SummaryMetric label="Active Users" value={activeCount} />
        <SummaryMetric label="Administrators" value={adminCount} />
        <SummaryMetric label="Members" value={memberCount} />
        <SummaryMetric label="Guests" value={guestCount} />
        <SummaryMetric label="Deactivated" value={deletedCount} />
      </SheetSummary>

      {/* Toolbar & Filters */}
      <Toolbar id="users-toolbar">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
          <Input
            id="users-search-input"
            type="search"
            aria-label="Search users by name or email"
            placeholder="Search by name or email..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">Role:</span>
            <Select
              id="filter-user-role"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-36"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="member">Members</option>
              <option value="guest">Guests</option>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">Status:</span>
            <Select
              id="filter-user-status"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "active" | "deleted" | "all")}
              className="w-36"
            >
              <option value="active">Active Only</option>
              <option value="deleted">Deactivated</option>
              <option value="all">All Members</option>
            </Select>
          </div>

          {(localSearch || roleFilter !== "all" || statusFilter !== "active") && (
            <Button
              id="btn-reset-user-filters"
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalSearch("");
                setRoleFilter("all");
                setStatusFilter("active");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </Toolbar>

      {/* Users Table / List */}
      <Card id="users-table-card" className="overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" id="users-table">
            <thead className="border-b border-border bg-secondary/60 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
              <tr>
                <th className="px-4 py-3.5 sm:px-6">Member</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <UserX className="mx-auto mb-2 h-8 w-8 text-subtle-foreground" />
                    <p className="font-medium">No users match your criteria.</p>
                    <p className="text-xs text-subtle-foreground">Try adjusting your search query or role filter.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserId;
                  const isUserAdmin = user.role === "admin";

                  return (
                    <tr
                      key={user.id}
                      id={`user-row-${user.id}`}
                      className={cn(
                        "transition-colors hover:bg-secondary/30",
                        user.isDeleted && "bg-secondary/20 opacity-65"
                      )}
                    >
                      <td className="px-4 py-3.5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <Avatar
                            color={user.avatarColor || "var(--primary)"}
                            size="md"
                            className="h-9 w-9 text-xs"
                          >
                            {user.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              getInitials(user.name)
                            )}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{user.name}</span>
                              {isCurrent && (
                                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  You
                                </span>
                              )}
                            </div>
                            {user.isDeleted && user.deletedAt && (
                              <span className="text-[11px] text-destructive">
                                Deactivated on {formatDate(user.deletedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-subtle-foreground shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {user.role === "admin" ? (
                          <Badge variant="positive" className="inline-flex items-center gap-1 font-medium">
                            <Shield className="h-3 w-3" />
                            <span>Admin</span>
                          </Badge>
                        ) : user.role === "member" ? (
                          <Badge variant="accent" className="inline-flex items-center gap-1 font-medium">
                            <UserCheck className="h-3 w-3" />
                            <span>Member</span>
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="inline-flex items-center gap-1 font-medium">
                            <UserIcon className="h-3 w-3" />
                            <span>Guest</span>
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {user.isDeleted ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            Deactivated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            Active
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right sm:px-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.isDeleted ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!isAdmin}
                              onClick={() => restoreUser(user.id)}
                              className="h-8 gap-1 text-xs"
                              title="Restore user account"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Restore</span>
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!isAdmin}
                                onClick={() => handleOpenEdit(user)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Edit user"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!isAdmin || isCurrent}
                                onClick={() => setDeletingUser(user)}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                title={isCurrent ? "You cannot delete your own account" : "Deactivate (soft delete) user"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Workspace User</DialogTitle>
            <DialogDescription>
              Create an authenticated team member with initial credentials and assign their role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
            {formError && (
              <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label htmlFor="input-new-user-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Full Name *
              </label>
              <Input
                id="input-new-user-name"
                required
                placeholder="e.g., Sarah Chen"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="input-new-user-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Email Address *
              </label>
              <Input
                id="input-new-user-email"
                type="email"
                required
                placeholder="e.g., sarah@collectivep.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="select-new-user-role" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Role *
              </label>
              <Select
                id="select-new-user-role"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                className="w-full"
              >
                <option value="member">Member — Internal (Must use @collectivep.com)</option>
                <option value="admin">Admin — Full Access (Must use @collectivep.com)</option>
                <option value="guest">Guest — Outside (Can use @collectivep.com, @gmail.com, @yahoo.com, etc.)</option>
              </Select>
              {newUser.role === "admin" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  <strong>Admin:</strong> Full access to all modules including Users, Reports, and Sales. Email domain must be <strong>@collectivep.com</strong>.
                </p>
              )}
              {newUser.role === "member" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  <strong>Member:</strong> Internal team access to Projects, Tasks & Timeline. Access to /users, /reports, and /sales is restricted. Email domain must be <strong>@collectivep.com</strong>.
                </p>
              )}
              {newUser.role === "guest" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  <strong>Guest:</strong> Outside partner access to Projects, Tasks & Timeline. Access to /users, /reports, and /sales is restricted. Can use <strong>any email domain</strong> (@collectivep.com, @gmail.com, @yahoo.com, etc.).
                </p>
              )}
            </div>

            <div>
              <label htmlFor="input-new-user-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Initial Password *
              </label>
              <div className="relative">
                <Input
                  id="input-new-user-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Min. 6 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                The user can use this password to sign in to the platform immediately.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Avatar Colour
              </label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Select colour ${color}`}
                    onClick={() => setNewUser({ ...newUser, avatarColor: color })}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border transition-transform",
                      newUser.avatarColor === color ? "border-foreground ring-2 ring-primary ring-offset-2" : "border-border hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {newUser.avatarColor === color && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating User…" : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editingUserId !== null} onOpenChange={(open) => !open && setEditingUserId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>Update user name, role, or visual settings.</DialogDescription>
          </DialogHeader>

          {(() => {
            const editingUserObj = users.find((u) => u.id === editingUserId);
            const editingUserEmail = editingUserObj?.email || "";
            const editingUserDomain = editingUserEmail.split("@").pop()?.toLowerCase() || "";
            const isEditingUserCollective = editingUserDomain === "collectivep.com";

            return (
              <div className="space-y-4 pt-2">
                {editError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{editError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="edit-user-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                    Full Name
                  </label>
                  <Input
                    id="edit-user-name"
                    value={editForm.name}
                    onChange={(e) => {
                      setEditError(null);
                      setEditForm({ ...editForm, name: e.target.value });
                    }}
                    placeholder="e.g. Alex Johnson"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                    Email Address
                  </label>
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/50 border border-border text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-foreground truncate">{editingUserEmail || "No email"}</span>
                    </div>
                    {isEditingUserCollective ? (
                      <Badge variant="accent" className="text-[10px] shrink-0 font-medium">@collectivep.com</Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[10px] shrink-0 font-medium">External Domain</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-user-role" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                    Role
                  </label>
                  <Select
                    id="edit-user-role"
                    value={editForm.role}
                    onChange={(e) => {
                      setEditError(null);
                      setEditForm({ ...editForm, role: e.target.value as UserRole });
                    }}
                    className="w-full"
                  >
                    {isEditingUserCollective ? (
                      <>
                        <option value="admin">Admin — Full Access (All modules & settings)</option>
                        <option value="member">Member — Internal (Projects, Tasks & Timeline)</option>
                        <option value="guest">Guest — Outside Partner (Projects, Tasks & Timeline)</option>
                      </>
                    ) : (
                      <>
                        <option value="guest">Guest — Outside Partner (Any email domain)</option>
                        <option value="admin" disabled>Admin — Restricted (Requires @collectivep.com email)</option>
                        <option value="member" disabled>Member — Restricted (Requires @collectivep.com email)</option>
                      </>
                    )}
                  </Select>

                  {isEditingUserCollective ? (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Email domain <strong>@collectivep.com</strong> verified. This account can be assigned the <strong>Admin</strong>, <strong>Member</strong>, or <strong>Guest</strong> role.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      Email is not from the @collectivep.com domain ({editingUserEmail}). This account <strong>cannot be assigned the Admin role</strong>.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                    Avatar Colour
                  </label>
                  <div className="flex items-center gap-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Select colour ${color}`}
                        onClick={() => setEditForm({ ...editForm, avatarColor: color })}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border transition-transform",
                          editForm.avatarColor === color ? "border-foreground ring-2 ring-primary ring-offset-2" : "border-border hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {editForm.avatarColor === color && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setEditingUserId(null)} disabled={isSavingEdit}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={!editForm.name.trim() || isSavingEdit || (editForm.role === "admin" && !isEditingUserCollective)}
                  >
                    {isSavingEdit ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Soft Delete Confirmation Dialog */}
      <Dialog open={deletingUser !== null} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate User Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong className="text-foreground">{deletingUser?.name}</strong> ({deletingUser?.email})?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <p className="border-l-2 border-destructive pl-3 text-xs">
              <strong>Soft Delete:</strong> This member will be hidden from assignment lists and removed from active roster views. However, their historical contributions, comments, and task references will be safely preserved and can be restored at any time.
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmSoftDelete}>
                Deactivate Member
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
