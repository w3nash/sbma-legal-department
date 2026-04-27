import "dotenv/config";

import { auth } from "../lib/auth";
import prisma from "../lib/prisma";

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "password123";

async function main() {
  console.log("🌱 Seeding database...\n");

  const users = [
    {
      name: "Admin User",
      email: "admin@sbma.com",
      role: "admin" as const,
    },
    {
      name: "Member User",
      email: "member@sbma.com",
      role: "member" as const,
    },
  ];

  for (const userData of users) {
    // Clean up existing user to ensure fresh password hash
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      console.log(`🗑️  Removing existing user: ${userData.email}`);
      await prisma.user.delete({ where: { id: existing.id } });
    }

    try {
      const result = (await auth.api.signUpEmail({
        body: {
          email: userData.email,
          password: DEFAULT_PASSWORD,
          name: userData.name,
        },
        asResponse: false,
      })) as { user?: { id: string } } | null;

      if (result?.user) {
        // Update role if not default member
        if (userData.role !== "member") {
          await prisma.user.update({
            where: { id: result.user.id },
            data: { role: userData.role },
          });
        }
        console.log(`✅ Created ${userData.role}: ${userData.email}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to create ${userData.email}:`, message);
    }
  }

  console.log("\n🎉 Seed complete!");
  console.log(`\nLogin credentials:`);
  console.log(`  Admin:  admin@sbma.com / ${DEFAULT_PASSWORD}`);
  console.log(`  Member: member@sbma.com / ${DEFAULT_PASSWORD}`);
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
