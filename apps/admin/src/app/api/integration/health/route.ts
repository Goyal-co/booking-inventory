import { NextResponse } from "next/server";
import { prisma } from "@booking/database";

export async function GET() {
  const checks = {
    database: false,
    integrations: true,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ok = checks.database;
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
