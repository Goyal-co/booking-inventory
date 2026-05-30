"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "admin-selected-project";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface AdminProject {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus?: string;
}

type AdminProjectsContextValue = {
  projects: AdminProject[];
  selectedProjectId: string | null;
  selectedProject: AdminProject | null;
  setSelectedProjectId: (projectId: string | null) => void;
  loading: boolean;
  refreshProjects: () => Promise<void>;
};

const AdminProjectsContext = createContext<AdminProjectsContextValue | null>(null);

let cachedProjects: AdminProject[] | null = null;
let cacheTimestamp = 0;
let inflightFetch: Promise<AdminProject[]> | null = null;

async function fetchProjectsCached(force = false): Promise<AdminProject[]> {
  const now = Date.now();
  if (!force && cachedProjects && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProjects;
  }
  if (inflightFetch) return inflightFetch;

  inflightFetch = fetch("/api/projects")
    .then((res) => res.json())
    .then((data) => {
      const list: AdminProject[] = data.projects ?? [];
      cachedProjects = list;
      cacheTimestamp = Date.now();
      return list;
    })
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

function readUrlProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("projectId");
}

function resolveSelectedId(
  list: AdminProject[],
  urlProjectId: string | null
): string | null {
  const storedId =
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

  if (urlProjectId === "all" || storedId === "all") {
    return null;
  }

  const preferredId = urlProjectId ?? storedId;
  const match = list.find((p) => p.id === preferredId);
  return match?.id ?? null;
}

export function AdminProjectsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<AdminProject[]>(() => cachedProjects ?? []);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !cachedProjects);
  const [urlProjectId, setUrlProjectId] = useState<string | null>(null);

  // Sync projectId from URL without useSearchParams (avoids layout-wide Suspense hang)
  useEffect(() => {
    setUrlProjectId(readUrlProjectId());
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const hasCache = !!cachedProjects;
      if (!hasCache) setLoading(true);

      try {
        const list = await fetchProjectsCached();
        if (cancelled) return;
        setProjects(list);
        setSelectedProjectIdState(resolveSelectedId(list, urlProjectId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [urlProjectId]);

  const setSelectedProjectId = useCallback(
    (projectId: string | null) => {
      setSelectedProjectIdState(projectId);
      const storageValue = projectId ?? "all";
      localStorage.setItem(STORAGE_KEY, storageValue);

      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : ""
      );
      if (projectId) {
        params.set("projectId", projectId);
      } else {
        params.set("projectId", "all");
      }
      router.replace(`${pathname}?${params.toString()}`);
      setUrlProjectId(projectId ?? "all");
    },
    [pathname, router]
  );

  const refreshProjects = useCallback(async () => {
    const list = await fetchProjectsCached(true);
    setProjects(list);
    setSelectedProjectIdState((current) => {
      if (current && list.some((p) => p.id === current)) return current;
      return resolveSelectedId(list, urlProjectId);
    });
  }, [urlProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const value = useMemo(
    () => ({
      projects,
      selectedProjectId,
      selectedProject,
      setSelectedProjectId,
      loading,
      refreshProjects,
    }),
    [projects, selectedProjectId, selectedProject, setSelectedProjectId, loading, refreshProjects]
  );

  return (
    <AdminProjectsContext.Provider value={value}>{children}</AdminProjectsContext.Provider>
  );
}

export function useAdminProject() {
  const ctx = useContext(AdminProjectsContext);
  if (!ctx) {
    throw new Error("useAdminProject must be used within AdminProjectsProvider");
  }
  return ctx;
}
