import Link from "next/link";
import { Route } from "@/lib/constants";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { Button } from "@/components/ui/button";
import { RiArrowLeftSLine } from "@remixicon/react";

export default function CreateUserPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Button
          variant="ghost"
          nativeButton={false}
          className="-ml-2 mb-2"
          render={<Link href={Route.AdminUsers} />}
        >
          <RiArrowLeftSLine className="mr-1 size-4" />
          Back to Users
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Create User</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new user account and assign their role and permissions.
        </p>
      </div>
      <CreateUserForm redirectTo={Route.AdminUsers} />
    </div>
  );
}
