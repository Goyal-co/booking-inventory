"use client";

import { useSession } from "next-auth/react";
import { TopBar } from "@/components/top-bar";
import { Card, CardContent, formatRole } from "@booking/ui";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-4 text-xl font-bold">Settings</h1>
        <Card>
          <CardContent className="space-y-2 p-4">
            <p><strong>Name:</strong> {session?.user?.name}</p>
            <p><strong>Email:</strong> {session?.user?.email}</p>
            <p><strong>Role:</strong> {formatRole(session?.user?.role)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
