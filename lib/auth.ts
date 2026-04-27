import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";
import { defaultRoles } from "better-auth/plugins/admin/access";
import prisma from "@/lib/prisma";
import { env } from "@/env";
import { UserRole } from "./constants";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: UserRole.Member,
        input: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
  plugins: [
    adminPlugin({
      defaultRole: UserRole.Member,
      adminRoles: [UserRole.Admin],
      roles: {
        [UserRole.Admin]: defaultRoles.admin,
        [UserRole.Member]: defaultRoles.user,
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
