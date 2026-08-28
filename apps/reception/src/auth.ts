import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, assertNextAuthSecret } from "@booking/database";
import { loginSchema } from "@booking/validators";
import { authConfig } from "./auth.config";

assertNextAuthSecret();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findFirst({
          where: { email: { equals: parsed.data.email, mode: "insensitive" } },
        });
        if (!user || !user.isActive || user.role !== "RECEPTION") return null;
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});
