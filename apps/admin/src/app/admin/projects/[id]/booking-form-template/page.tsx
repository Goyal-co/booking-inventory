"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminProject } from "@/hooks/use-admin-project";

/** Legacy URL — redirect to unified Form Templates (same per-project editor). */
export default function ProjectBookingFormTemplateRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { setSelectedProjectId } = useAdminProject();
  const id = String(params.id ?? "");

  useEffect(() => {
    if (!id) return;
    setSelectedProjectId(id);
    router.replace(`/admin/templates`);
  }, [id, router, setSelectedProjectId]);

  return <p className="p-6 text-sm text-gray-500">Opening booking form template…</p>;
}
