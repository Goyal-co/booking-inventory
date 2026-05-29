"use client";

import { useSession } from "next-auth/react";

export function useAdminSession() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  return {
    session,
    status,
    role,
    isSuperAdmin: role === "SUPER_ADMIN",
    isProjectAdmin: role === "PROJECT_ADMIN",
    projectIds: session?.user?.projectIds ?? [],
    isLoading: status === "loading",
  };
}
