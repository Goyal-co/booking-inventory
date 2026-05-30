"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "sales-selected-project";
const CACHE_TTL_MS = 5 * 60 * 1000;

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

type SalesProjectsContextValue = {
  projects: SelectedProjectInfo[];
  selectedProject: SelectedProjectInfo | null;
  setSelectedProject: (projectId: string) => void;
  refetchProjects: () => Promise<void>;
  loading: boolean;
};

const SalesProjectsContext = createContext<SalesProjectsContextValue | null>(null);

let cachedProjects: SelectedProjectInfo[] | null = null;
let cacheTimestamp = 0;
let inflightFetch: Promise<SelectedProjectInfo[]> | null = null;

async function fetchProjectsCached(force = false): Promise<SelectedProjectInfo[]> {
  const now = Date.now();
  if (!force && cachedProjects && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProjects;
  }
  if (inflightFetch) return inflightFetch;

  inflightFetch = fetch("/api/projects")
    .then((res) => res.json())
    .then((data) => {
      const list: SelectedProjectInfo[] = data.projects ?? [];
      cachedProjects = list;
      cacheTimestamp = Date.now();
      return list;
    })
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

function resolveSelected(
  list: SelectedProjectInfo[],
  urlProjectId: string | null
): SelectedProjectInfo | null {
  const storedId =
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const preferredId = urlProjectId ?? storedId;
  const match = list.find((p) => p.id === preferredId) ?? list[0] ?? null;
  if (match && typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, match.id);
  }
  return match;
}

export function SalesProjectsProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<SelectedProjectInfo[]>(() => cachedProjects ?? []);
  const [selectedProject, setSelectedProjectState] = useState<SelectedProjectInfo | null>(null);
  const [loading, setLoading] = useState(() => !cachedProjects);

  const urlProjectId = searchParams.get("projectId");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const hasCache = !!cachedProjects;
      if (!hasCache) setLoading(true);

      try {
        const list = await fetchProjectsCached();
        if (cancelled) return;
        setProjects(list);
        setSelectedProjectState(resolveSelected(list, urlProjectId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [urlProjectId]);

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
    const list = await fetchProjectsCached(true);
    setProjects(list);
    setSelectedProjectState((current) => {
      if (!current) return list[0] ?? null;
      return list.find((p) => p.id === current.id) ?? list[0] ?? null;
    });
  }, []);

  const value = useMemo(
    () => ({
      projects,
      selectedProject,
      setSelectedProject,
      refetchProjects,
      loading,
    }),
    [projects, selectedProject, setSelectedProject, refetchProjects, loading]
  );

  return (
    <SalesProjectsContext.Provider value={value}>{children}</SalesProjectsContext.Provider>
  );
}

export function useSelectedProject() {
  const ctx = useContext(SalesProjectsContext);
  if (!ctx) {
    throw new Error("useSelectedProject must be used within SalesProjectsProvider");
  }
  return ctx;
}
