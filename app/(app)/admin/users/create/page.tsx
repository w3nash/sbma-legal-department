import { Route } from "@/lib/constants";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

export default function CreateUserPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create User</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new user account and assign their role and permissions.
        </p>
      </div>
      <CreateUserForm redirectTo={Route.AdminUsers} />
    </div>
  );
}
