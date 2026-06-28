"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Avatar,
  Badge,
  formatRole,
} from "@booking/ui";
import { toast, Toaster } from "sonner";

export default function AdminSettingsPage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    mobile: string;
    role: string;
    isActive: boolean;
    employeeId: string | null;
    joiningDate: string | null;
    createdAt: string;
  } | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile));
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profile.name, mobile: profile.mobile }),
    });
    if (res.ok) {
      toast.success("Profile updated");
      await update();
    } else {
      toast.error("Failed to update profile");
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Password updated");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      toast.error(data.error ?? "Failed to update password");
    }
  };

  if (!profile) {
    return <div className="p-6 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader title="Settings" description="Manage your account and security preferences." />

      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Avatar name={profile.name} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{profile.name}</h2>
              <p className="text-sm text-gray-500">{formatRole(profile.role)}</p>
            </div>
            <Badge variant={profile.isActive ? "success" : "danger"}>
              {profile.isActive ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Profile</h3>
            <div>
              <Label>Name</Label>
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile.email} disabled />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={profile.mobile ?? ""} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
            </div>
            <Button onClick={saveProfile}>Save Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Security</h3>
            <p className="text-sm text-gray-500">Change your password regularly to keep your account secure.</p>
            <div>
              <Label>Current Password</Label>
              <Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
            </div>
            <div>
              <Label>New Password</Label>
              <Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
            </div>
            <Button onClick={changePassword}>Update Password</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <h3 className="font-semibold">Account Information</h3>
            <p><strong>Role:</strong> {formatRole(profile.role)}</p>
            {profile.employeeId && <p><strong>Employee ID:</strong> {profile.employeeId}</p>}
            <p><strong>Account Created:</strong> {new Date(profile.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
