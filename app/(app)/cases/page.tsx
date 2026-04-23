import { requireAuth } from "@/lib/auth-guards";

export default async function CasesPage() {
  const session = await requireAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cases</h1>
      <p className="text-muted-foreground">
        Welcome back, {session.user.name}. Manage your cases here.
      </p>
    </div>
  );
}
