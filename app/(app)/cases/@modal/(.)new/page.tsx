"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CreateCaseForm } from "@/components/cases/CreateCaseForm";

const FORM_ID = "create-case-sheet-form";

export default function CreateCaseModal() {
  const router = useRouter();
  const close = () => router.back();

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New Case</SheetTitle>
          <SheetDescription>
            Create a new case to organise documents and manage team member
            access.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-0">
          <CreateCaseForm formId={FORM_ID} hideSubmit onSuccess={close} />
        </div>
        <SheetFooter className="grid grid-cols-2">
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button type="submit" form={FORM_ID}>
            Create Case
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
