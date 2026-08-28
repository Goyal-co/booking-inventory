import { prisma } from "../index";
import type { Prisma } from "@prisma/client";

/** Normalize login / account emails to lowercase for consistent lookups. */
export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Case-insensitive user lookup (handles legacy mixed-case emails). */
export async function findUserByEmail<T extends Prisma.UserInclude | undefined>(
  email: string,
  include?: T
) {
  const normalized = normalizeUserEmail(email);
  const exact = await prisma.user.findUnique({
    where: { email: normalized },
    ...(include ? { include } : {}),
  });
  if (exact) return exact;

  return prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    ...(include ? { include } : {}),
  });
}
