import { requireAuth } from "@/lib/auth-guards";

export default async function CasesPage() {
  const session = await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {session.user.name}. Browse and manage all legal cases assigned to you.
        </p>
      </div>
    </div>
  );
}
