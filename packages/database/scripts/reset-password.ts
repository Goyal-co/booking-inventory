import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CANDIDATE_EMAILS = ["superadmin@goyla.com", "superadmin@goyalco.com"];
const NEW_PASSWORD = process.env.RESET_PASSWORD ?? "Admin@123@";

async function main() {
  let user = null;
  for (const email of CANDIDATE_EMAILS) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) break;
  }

  if (!user) {
    const matches = await prisma.user.findMany({
      where: { email: { contains: "superadmin", mode: "insensitive" } },
      select: { email: true, role: true },
    });
    console.error("Super admin not found. Similar users:", matches);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isActive: true },
  });

  console.log(`Password reset successful for ${user.email} (${user.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
