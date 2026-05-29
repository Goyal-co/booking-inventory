/**
 * Production first-time setup: organization + Super Admin.
 * Idempotent — skips if an active Super Admin already exists for the org.
 *
 * Usage:
 *   ORGANIZATION_NAME="Acme Realty" \
 *   SUPER_ADMIN_EMAIL="admin@acme.com" \
 *   SUPER_ADMIN_PASSWORD="<strong-password>" \
 *   pnpm db:bootstrap
 */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WEAK_SECRETS = new Set(["change-me-in-production", "secret", "password", "password123"]);
const DEMO_PASSWORDS = new Set(["password123", "admin123", "changeme"]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;

  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!nextAuthSecret || nextAuthSecret.length < 32 || WEAK_SECRETS.has(nextAuthSecret)) {
    throw new Error(
      "Set NEXTAUTH_SECRET to a random string of at least 32 characters before production bootstrap."
    );
  }

  const wsSecret = process.env.WS_INTERNAL_SECRET?.trim();
  if (!wsSecret || wsSecret.length < 32 || WEAK_SECRETS.has(wsSecret)) {
    throw new Error(
      "Set WS_INTERNAL_SECRET to a random string of at least 32 characters before production bootstrap."
    );
  }
}

function validatePassword(password: string) {
  if (password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }
  if (DEMO_PASSWORDS.has(password)) {
    throw new Error("SUPER_ADMIN_PASSWORD must not be a known default/demo password.");
  }
}

async function main() {
  assertProductionSecrets();

  const orgName = process.env.ORGANIZATION_NAME?.trim() || "My Organization";
  const orgSlug = process.env.ORGANIZATION_SLUG?.trim() || slugify(orgName);
  const email = requireEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";
  const password = requireEnv("SUPER_ADMIN_PASSWORD");

  validatePassword(password);

  if (!orgSlug) {
    throw new Error("ORGANIZATION_SLUG could not be derived — set it explicitly.");
  }

  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: orgName, slug: orgSlug },
    });
    console.log(`Created organization: ${org.name} (${org.slug})`);
  } else {
    console.log(`Using existing organization: ${org.name} (${org.slug})`);
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      organizationId: org.id,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  if (existingSuperAdmin) {
    console.log("Active Super Admin already exists:", existingSuperAdmin.email);
    console.log("Bootstrap skipped (safe to re-run).");
    return;
  }

  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    throw new Error(`Email already registered: ${email}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
    },
  });

  console.log("Bootstrap complete.");
  console.log("  Organization:", org.name);
  console.log("  Super Admin email:", email);
  console.log("  Log in at your Admin Panel URL with SUPER_ADMIN_PASSWORD (not printed).");
}

main()
  .catch((error) => {
    console.error("Bootstrap failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
