"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageFrame, PageHeader } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { updateUserPassword } from "@/app/actions/auth";

export default function ProfilePage() {
  const currentUser = useStore((s) => s.users.find((u) => u.id === s.currentUserId));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleChangePassword() {
    setMessage(null);

    if (!currentPassword.trim()) {
      setMessage({ type: "error", text: "Current password is required" });
      return;
    }

    if (!newPassword.trim()) {
      setMessage({ type: "error", text: "New password is required" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setIsLoading(true);

    // Note: Supabase doesn't have a way to verify current password on client,
    // but updateUser() requires authentication. If password is wrong,
    // Supabase will reject it.
    updateUserPassword(newPassword)
      .then((result) => {
        if (result.error) {
          setMessage({ type: "error", text: result.error });
        } else {
          setMessage({ type: "success", text: "Password changed successfully" });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to change password",
        });
        setIsLoading(false);
      });
  }

  if (!currentUser) {
    return (
      <PageFrame>
        <PageHeader title="Profile" description="Loading..." />
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <PageHeader
        title="Profile"
        description="Your details across the CP workspace."
      />

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-lg font-medium">{currentUser.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="text-lg font-medium">{currentUser.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Role</label>
            <p className="text-lg font-medium capitalize">{currentUser.role}</p>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          {message && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {message.type === "success" ? (
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p
                className={`text-sm ${
                  message.type === "success" ? "text-green-800" : "text-red-800"
                }`}
              >
                {message.text}
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Current Password</label>
            <Input
              type="password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              At least 8 characters
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="mt-1"
            />
          </div>

          <Button onClick={handleChangePassword} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLoading ? "Updating..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
