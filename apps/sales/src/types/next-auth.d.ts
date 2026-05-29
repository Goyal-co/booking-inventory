import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId: string;
      projectIds: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    organizationId: string;
    projectIds: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    projectIds: string[];
  }
}

export {};
