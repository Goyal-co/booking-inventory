/**
 * One-time safe fix: lowercase all user emails in DB.
 * Usage: pnpm exec tsx prisma/normalize-user-emails.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  let updated = 0;
  for (const user of users) {
    const normalized = user.email.trim().toLowerCase();
    if (normalized !== user.email) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: normalized },
      });
      console.log(`Updated: ${user.email} → ${normalized}`);
      updated += 1;
    }
  }
  console.log(`Done. ${updated} email(s) normalized.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
