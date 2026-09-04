"use strict";

/**
 * Container boot for Booking_Inventory:
 *   1. prisma migrate deploy (unless SKIP_DB_MIGRATE=1)
 *   2. optional prisma db push when DB_PUSH_ON_BOOT=1
 *   3. optional Super Admin bootstrap when SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD are set
 *
 * Prefer migrate deploy on shared RDS. DB_PUSH_ON_BOOT is for empty/dev DBs only.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

function schemaPath() {
  return path.join(__dirname, "packages/database/prisma/schema.prisma");
}

function prismaEntry() {
  try {
    return require.resolve("prisma/build/index.js");
  } catch {
    console.error("[db] prisma CLI not found in node_modules");
    process.exit(1);
  }
}

function runPrisma(args, label) {
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
    console.error(`[db] prisma ${args.join(" ")} failed`);
    process.exit(result.status ?? 1);
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function ensureSchema() {
  if (process.env.SKIP_DB_MIGRATE === "1" && process.env.DB_PUSH_ON_BOOT !== "1") {
    console.info("[db] SKIP_DB_MIGRATE=1 — skipping migrations");
    return;
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
    console.error("[admin] SUPER_ADMIN_PASSWORD must be at least 12 characters");
    process.exit(1);
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
