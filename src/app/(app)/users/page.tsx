"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { cn, generateId, formatDate } from "@/lib/utils";
import type { User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageFrame, PageHeader, Toolbar } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { createUserWithPassword } from "@/app/actions/auth";

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  guest: "Guest",
};

const roleBadgeVariants: Record<string, string> = {
  admin: "default",
  guest: "secondary",
};

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser, searchQuery } = useStore();
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "guest">("guest");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    role: "admin" | "guest";
  }>({
    name: "",
    email: "",
    role: "guest",
  });

  const query = searchQuery.trim().toLowerCase();
  const filteredUsers = users
    .filter((u) => {
      if (!query) return true;
      return (
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        roleLabels[u.role].toLowerCase().includes(query)
      );
    });

  // Separate active and deleted users
  const activeUsers = filteredUsers.filter((u) => !u.deletedAt);
  const deletedUsers = filteredUsers.filter((u) => u.deletedAt);

  function handleCreateUser() {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    createUserWithPassword(newUserEmail.trim(), newUserPassword.trim(), newUserName.trim(), newUserRole)
      .then((result) => {
        if (result.error) {
          setErrorMessage(result.error);
          setIsLoading(false);
          return;
        }
        if (result.user) {
          addUser(result.user);
        }
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("guest");
        setShowNewUser(false);
        setIsLoading(false);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Failed to create user");
        setIsLoading(false);
      });
  }

  function openEditUser(user: User) {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }

  function handleSaveUser() {
    if (!editingUserId || !editForm.name.trim() || !editForm.email.trim()) return;
    updateUser(editingUserId, {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      role: editForm.role,
    });
    setEditingUserId(null);
  }

  function handleDeleteUser(user: User) {
    if (window.confirm(`Soft delete "${user.name}"? They can be restored later.`)) {
      deleteUser(user.id);
    }
  }

  function handleRestoreUser(userId: string) {
    updateUser(userId, { deletedAt: null });
  }

  return (
    <>
      <PageFrame>
        <PageHeader
          title="User Management"
          description={`${activeUsers.length} ${activeUsers.length === 1 ? "user" : "users"} active${deletedUsers.length > 0 ? `, ${deletedUsers.length} deleted` : ""}`}
          actions={<Button size="sm" onClick={() => setShowNewUser(true)}><Plus className="w-4 h-4" /> Add User</Button>}
        />

        {/* Active Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            {activeUsers.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No active users found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{user.name}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={roleBadgeVariants[user.role] as any}>
                            {roleLabels[user.role]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditUser(user)}
                              className="gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                              className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deleted Users Section */}
        {deletedUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Deleted Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm opacity-60">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Deleted</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="font-medium line-through">{user.name}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground line-through">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={roleBadgeVariants[user.role] as any}>
                            {roleLabels[user.role]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {user.deletedAt ? formatDate(user.deletedAt) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreUser(user.id)}
                            className="gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </PageFrame>

      {/* New User Dialog */}
      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account with initial password</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Full name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                disabled={isLoading}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="user@collectivep.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={isLoading}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Initial Password</label>
              <Input
                type="password"
                placeholder="Set initial password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                disabled={isLoading}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">User can change password after first login</p>
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as "admin" | "guest")}
                disabled={isLoading}
              >
                <option value="guest">Guest</option>
                <option value="admin">Administrator</option>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewUser(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editingUserId && (
        <Dialog open={!!editingUserId} onOpenChange={(open) => !open && setEditingUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="Full name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="user@collectivep.com"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "admin" | "guest" })}
                >
                  <option value="guest">Guest</option>
                  <option value="admin">Administrator</option>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingUserId(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveUser}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
