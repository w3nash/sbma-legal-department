import { requireAdmin } from "@/lib/auth-guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Administration</h1>
      {children}
    </div>
  );
}
