import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, assertNextAuthSecret } from "@booking/database";
import { loginSchema } from "@booking/validators";

assertNextAuthSecret();

const cookiePrefix = "admin";

export const { handlers, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
          include: {
            projectAccess: { select: { projectId: true } },
          },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // Only allow admin roles on admin panel
        if (!["SUPER_ADMIN", "PROJECT_ADMIN"].includes(user.role)) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          projectIds: user.projectAccess.map((p) => p.projectId),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as { role: string }).role;
        token.organizationId = (user as { organizationId: string }).organizationId;
        token.projectIds = (user as { projectIds: string[] }).projectIds;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
        session.user.projectIds = (token.projectIds as string[]) ?? [];
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});
