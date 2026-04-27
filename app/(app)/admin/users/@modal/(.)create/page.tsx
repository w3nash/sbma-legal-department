"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

const FORM_ID = "create-user-sheet-form";

export default function CreateUserModal() {
  const router = useRouter();
  const close = () => router.back();

  return (
    <Sheet open onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create User</SheetTitle>
          <SheetDescription>
            Add a new user account and assign their role and permissions.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-0">
          <CreateUserForm
            formId={FORM_ID}
            hideSubmit
            onSuccess={close}
          />
        </div>
        <SheetFooter className="grid grid-cols-2">
          <SheetClose render={<Button variant="outline" />}>
            Cancel
          </SheetClose>
          <Button type="submit" form={FORM_ID}>
            Create User
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
