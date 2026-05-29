"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "admin-selected-project";

export interface AdminProject {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus?: string;
}

export function useAdminProject() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const list: AdminProject[] = data.projects ?? [];
      setProjects(list);

      const urlProjectId = searchParams.get("projectId");
      const storedId =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

      if (urlProjectId === "all" || storedId === "all") {
        setSelectedProjectIdState(null);
      } else {
        const preferredId = urlProjectId ?? storedId;
        const match = list.find((p) => p.id === preferredId);
        setSelectedProjectIdState(match?.id ?? null);
      }
      setLoading(false);
    }
    load();
  }, [searchParams]);

  const setSelectedProjectId = useCallback(
    (projectId: string | null) => {
      setSelectedProjectIdState(projectId);
      const storageValue = projectId ?? "all";
      localStorage.setItem(STORAGE_KEY, storageValue);

      const params = new URLSearchParams(searchParams.toString());
      if (projectId) {
        params.set("projectId", projectId);
      } else {
        params.set("projectId", "all");
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  return {
    projects,
    selectedProjectId,
    selectedProject,
    setSelectedProjectId,
    loading,
  };
}
