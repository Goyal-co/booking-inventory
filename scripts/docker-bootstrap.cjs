"use strict";

/**
 * Container boot for Booking_Inventory:
 *   1. Fresh DB (no User table) → prisma db push + mark migrations applied
 *   2. Existing DB → prisma migrate deploy (unless SKIP_DB_MIGRATE=1)
 *   3. Optional DB_PUSH_ON_BOOT=1
 *   4. Optional Super Admin when SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD are set
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function schemaPath() {
  return path.join(__dirname, "packages/database/prisma/schema.prisma");
}

function migrationsDir() {
  return path.join(__dirname, "packages/database/prisma/migrations");
}

function prismaEntry() {
  const candidates = [
    "/opt/prisma-cli/node_modules/prisma/build/index.js",
    path.join(__dirname, "node_modules/prisma/build/index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    return require.resolve("prisma/build/index.js");
  } catch {
    console.error("[db] prisma CLI not found (expected /opt/prisma-cli or node_modules)");
    process.exit(1);
  }
}

function runPrisma(args, label, { allowFailure = false } = {}) {
  console.info(`[db] ${label}`);
  const result = spawnSync(
    process.execPath,
    [prismaEntry(), ...args, "--schema", schemaPath()],
    { stdio: "inherit", env: process.env },
  );
  if (result.error) {
    console.error("[db] failed to start prisma:", result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (allowFailure) {
      console.warn(`[db] prisma ${args.join(" ")} exited ${result.status} — continuing`);
      return false;
    }
    console.error(`[db] prisma ${args.join(" ")} failed`);
    process.exit(result.status ?? 1);
  }
  return true;
}

function listMigrationDirs() {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      if (name === "migration_lock.toml") return false;
      try {
        return fs.statSync(path.join(dir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    tableName,
  );
  return Boolean(rows[0]?.present);
}

async function listFailedMigrations(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
    );
    return rows.map((row) => row.migration_name).filter(Boolean);
  } catch {
    return [];
  }
}

function markMigrationsApplied() {
  for (const name of listMigrationDirs()) {
    runPrisma(
      ["migrate", "resolve", "--applied", name],
      `mark migration applied: ${name}`,
      { allowFailure: true },
    );
  }
}

async function ensureSchema() {
  if (process.env.SKIP_DB_MIGRATE === "1" && process.env.DB_PUSH_ON_BOOT !== "1") {
    console.info("[db] SKIP_DB_MIGRATE=1 — skipping migrations");
    return;
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let hasUser = false;
  let failed = [];
  try {
    hasUser = await tableExists(prisma, "User");
    failed = await listFailedMigrations(prisma);
  } catch (err) {
    console.warn("[db] could not probe schema:", err instanceof Error ? err.message : err);
  } finally {
    await prisma.$disconnect();
  }

  // Baseline migration is a no-op (SELECT 1). Fresh DBs need db push first.
  if (!hasUser) {
    console.info("[db] empty / incomplete schema — syncing with prisma db push");
    runPrisma(["db", "push", "--skip-generate"], "prisma db push (fresh database)");
    markMigrationsApplied();
    console.info("[db] schema ready (db push + migration baseline)");
    return;
  }

  // Schema already present but a prior migrate left a failed row — resolve then deploy.
  if (failed.length > 0) {
    console.warn("[db] clearing failed migrations:", failed.join(", "));
    for (const name of failed) {
      runPrisma(
        ["migrate", "resolve", "--applied", name],
        `resolve failed migration as applied: ${name}`,
        { allowFailure: true },
      );
    }
  }

  if (process.env.SKIP_DB_MIGRATE !== "1") {
    runPrisma(["migrate", "deploy"], "applying pending Prisma migrations");
    console.info("[db] migrations applied");
  }

  if (process.env.DB_PUSH_ON_BOOT === "1") {
    runPrisma(["db", "push", "--skip-generate"], "optional schema sync with prisma db push");
    console.info("[db] schema synced via db push");
  }
}

async function ensureSuperAdmin() {
  if (process.env.SKIP_ADMIN_BOOTSTRAP === "1") {
    console.info("[admin] SKIP_ADMIN_BOOTSTRAP=1 — skipping");
    return;
  }

  const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "";
  if (!email || !password) {
    console.info("[admin] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping bootstrap");
    return;
  }
  if (password.length < 12) {
    console.warn("[admin] SUPER_ADMIN_PASSWORD must be at least 12 characters — skipping bootstrap");
    return;
  }

  const { PrismaClient } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const orgName = (process.env.ORGANIZATION_NAME || "My Organization").trim();
  const orgSlug = (process.env.ORGANIZATION_SLUG || "").trim() || slugify(orgName);
  const name = (process.env.SUPER_ADMIN_NAME || "Super Admin").trim();

  const prisma = new PrismaClient();
  try {
    let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: orgName, slug: orgSlug },
      });
      console.info("[admin] created organization:", org.slug);
    }

    const existing = await prisma.user.findFirst({
      where: {
        organizationId: org.id,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    if (existing) {
      console.info("[admin] Super Admin already exists — skipping:", existing.email);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
        organizationId: org.id,
      },
    });
    console.info("[admin] Super Admin created:", email);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[db] DATABASE_URL is not set");
    process.exit(1);
  }
  await ensureSchema();
  await ensureSuperAdmin();
}

main().catch((error) => {
  console.error("[bootstrap] failed:", error.message || error);
  process.exit(1);
});
