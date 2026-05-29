"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "sales-selected-project";

export interface SelectedProjectInfo {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  maxBlocksPerUser: number;
  blockDurationMs: number;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  canBlock: boolean;
  blockDurationLabel: string | null;
  requiresBookingApproval: boolean;
}

async function fetchProjects(): Promise<SelectedProjectInfo[]> {
  const res = await fetch("/api/projects");
  const data = await res.json();
  return data.projects ?? [];
}

export function useSelectedProject() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<SelectedProjectInfo[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<SelectedProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const list = await fetchProjects();
    setProjects(list);

    const urlProjectId = searchParams.get("projectId");
    const storedId =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const preferredId = urlProjectId ?? storedId;
    const match = list.find((p) => p.id === preferredId) ?? list[0] ?? null;
    setSelectedProjectState(match);
    if (match && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, match.id);
    }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const onFocus = () => {
      fetchProjects().then(setProjects);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const setSelectedProject = useCallback(
    (projectId: string) => {
      const match = projects.find((p) => p.id === projectId);
      if (!match) return;
      setSelectedProjectState(match);
      localStorage.setItem(STORAGE_KEY, projectId);

      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", projectId);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [projects, pathname, router, searchParams]
  );

  const refetchProjects = useCallback(async () => {
    const list = await fetchProjects();
    setProjects(list);
    setSelectedProjectState((current) => {
      if (!current) return list[0] ?? null;
      return list.find((p) => p.id === current.id) ?? list[0] ?? null;
    });
  }, []);

  return {
    projects,
    selectedProject,
    setSelectedProject,
    refetchProjects,
    loading,
  };
}
