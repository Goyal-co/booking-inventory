/**
 * Ensures reception login + Rudra demo leads exist (safe to re-run).
 * Usage: pnpm exec tsx prisma/ensure-reception.ts
 */
import { PrismaClient, UserRole, LeadSource } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org =
    (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.organization.create({
      data: { name: "Goyal Hariyana Sales", slug: "demo-realty" },
    }));

  const passwordHash = await bcrypt.hash("password123", 12);

  const reception = await prisma.user.upsert({
    where: { email: "reception@demo.com" },
    update: {
      passwordHash,
      name: "Reception Desk",
      role: UserRole.RECEPTION,
      isActive: true,
      organizationId: org.id,
    },
    create: {
      email: "reception@demo.com",
      name: "Reception Desk",
      passwordHash,
      role: UserRole.RECEPTION,
      organizationId: org.id,
    },
  });

  await prisma.leadRegistry.upsert({
    where: { leadId: "CP-ABC-000001" },
    update: {
      customerName: "Multi Partner Guest",
      customerPhone: "9876500001",
      cpId: "CP-ABC",
      source: LeadSource.CHANNEL_PARTNER,
      titanCrmId: "TITAN-MULTI-CP",
    },
    create: {
      leadId: "CP-ABC-000001",
      organizationId: org.id,
      customerName: "Multi Partner Guest",
      customerPhone: "9876500001",
      cpId: "CP-ABC",
      source: LeadSource.CHANNEL_PARTNER,
      titanCrmId: "TITAN-MULTI-CP",
      intentType: "EOI",
      registeredById: reception.id,
      createdAt: new Date("2026-07-20T10:15:00.000Z"),
    },
  });

  await prisma.leadRegistry.upsert({
    where: { leadId: "CP-XYZ-000001" },
    update: {
      customerName: "Multi Partner Guest",
      customerPhone: "9876500001",
      cpId: "CP-XYZ",
      source: LeadSource.CHANNEL_PARTNER,
      titanCrmId: "TITAN-MULTI-CP",
    },
    create: {
      leadId: "CP-XYZ-000001",
      organizationId: org.id,
      customerName: "Multi Partner Guest",
      customerPhone: "9876500001",
      cpId: "CP-XYZ",
      source: LeadSource.CHANNEL_PARTNER,
      titanCrmId: "TITAN-MULTI-CP",
      intentType: "Leads",
      registeredById: reception.id,
      createdAt: new Date("2026-07-22T14:40:00.000Z"),
    },
  });

  await prisma.leadRegistry.upsert({
    where: { leadId: "CP-SINGLE-000001" },
    update: {},
    create: {
      leadId: "CP-SINGLE-000001",
      organizationId: org.id,
      customerName: "Single Partner Guest",
      customerPhone: "9876500002",
      cpId: "CP-ABC",
      source: LeadSource.CHANNEL_PARTNER,
      titanCrmId: "TITAN-SINGLE",
      registeredById: reception.id,
    },
  });

  console.log("Reception ready:");
  console.log("  URL:      http://localhost:3004/login");
  console.log("  Email:    reception@demo.com");
  console.log("  Password: password123");
  console.log("  Demo phones: 9876500001 (multi-CP), 9876500002 (single), 9876500003 (Titan-only), 8888888888 (no partner)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
