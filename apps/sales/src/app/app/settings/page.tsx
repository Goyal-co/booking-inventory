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
import { useSelectedProject } from "@/hooks/use-selected-project";
import { toast, Toaster } from "sonner";

const PREF_KEYS = [
  { key: "bookingApproved", label: "Booking Approved Notifications" },
  { key: "unitRelease", label: "Unit Release Alerts" },
  { key: "dailySummary", label: "Daily Summary Email" },
  { key: "bookingRejected", label: "Booking Rejected Notifications" },
  { key: "systemAnnouncements", label: "System Announcements" },
] as const;

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const { projects } = useSelectedProject();
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    mobile: string;
    role: string;
    isActive: boolean;
    employeeId: string | null;
    joiningDate: string | null;
    createdAt: string;
    notificationPrefs: Record<string, boolean> | null;
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
      body: JSON.stringify({
        name: profile.name,
        mobile: profile.mobile,
        notificationPrefs: profile.notificationPrefs,
      }),
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

  const prefs = profile.notificationPrefs ?? {};

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader title="Settings" description="Manage your profile, security, and notification preferences." />

      <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-6">
            <Avatar name={profile.name} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{profile.name}</h2>
              <p className="text-sm text-gray-500">{formatRole(profile.role)}</p>
              <p className="text-xs text-gray-400">{projects.map((p) => p.name).join(", ")}</p>
            </div>
            <Badge variant={profile.isActive ? "success" : "danger"}>
              {profile.isActive ? "Active" : "Inactive"}
            </Badge>
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
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Notification Preferences</h3>
            {PREF_KEYS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs[key] !== false}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      notificationPrefs: { ...prefs, [key]: e.target.checked },
                    })
                  }
                  className="rounded border-gray-300 text-brand-500"
                />
                {label}
              </label>
            ))}
            <Button onClick={saveProfile}>Save Preferences</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <h3 className="font-semibold">Account Information</h3>
            <p><strong>Role:</strong> {formatRole(profile.role)}</p>
            {profile.employeeId && <p><strong>Employee ID:</strong> {profile.employeeId}</p>}
            {profile.joiningDate && (
              <p><strong>Joining Date:</strong> {new Date(profile.joiningDate).toLocaleDateString()}</p>
            )}
            <p><strong>Account Created:</strong> {new Date(profile.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold">Need Help?</h3>
            <p className="mt-2 text-sm text-gray-500">info.bng@goyalco.com · +91 80888 66000</p>
            <p className="text-xs text-gray-400">Support hours: Mon - Sat, 10:00 AM to 7:00 PM</p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400">
          © 2026 Goyal Hariyana Constructions. All rights reserved.
        </p>
      </div>
    </div>
  );
}
