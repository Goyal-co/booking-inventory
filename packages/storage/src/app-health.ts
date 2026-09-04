import { getStorageMode } from "./provider";
import { storageHealthCheck } from "./health";

const HEALTH_HEADERS = {
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

type PrismaLike = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/**
 * Shared health handler for AWS ALB / ECS / Docker HEALTHCHECK.
 * - GET /health?live=1 → liveness (no dependency checks)
 * - GET /health → readiness (database + storage)
 * Uses Web Response (no Next.js dependency in @goyal/storage).
 */
export async function runBookingHealthCheck(
  req: Request,
  service: string,
  prisma: PrismaLike,
): Promise<Response> {
  const url = new URL(req.url);
  const live = url.searchParams.get("live") === "1";
  const timestamp = new Date().toISOString();

  if (live) {
    return Response.json(
      { status: "ok", live: true, service, timestamp },
      { status: 200, headers: HEALTH_HEADERS },
    );
  }

  const checks: Record<string, boolean> = {
    database: false,
    storage: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const mode = getStorageMode();
  try {
    const storage = await storageHealthCheck();
    checks.storage = storage.ok;
  } catch {
    checks.storage = mode === "local";
  }

  const storageOk = mode === "local" || checks.storage;
  const ok = checks.database && storageOk;

  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      service,
      mode,
      checks,
      timestamp,
    },
    { status: ok ? 200 : 503, headers: HEALTH_HEADERS },
  );
}
