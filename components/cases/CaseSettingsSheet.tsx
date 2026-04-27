"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RiSettings4Line } from "@remixicon/react";
import { CaseSettingsForm } from "@/components/cases/CaseSettingsForm";

const FORM_ID = "case-settings-form";

export function CaseSettingsSheet({
  caseId,
  title,
  caseNumber,
  description,
  status,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  caseId: string;
  title: string;
  caseNumber: string | null;
  description: string | null;
  status: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;

  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <RiSettings4Line className="mr-1.5 size-4" />
          Settings
        </SheetTrigger>
      )}
      <SheetContent className="flex flex-col overflow-hidden data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle>Case Settings</SheetTitle>
          <SheetDescription>
            Update the case details, status, and reference number.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6">
          {/*
           * key={String(open)} remounts the form on each open, resetting
           * defaultValues from the latest props without a manual useEffect.
           */}
          <CaseSettingsForm
            key={String(open)}
            caseId={caseId}
            title={title}
            caseNumber={caseNumber}
            description={description}
            status={status}
            formId={FORM_ID}
            hideSubmit
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
        <SheetFooter className="grid grid-cols-2">
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button form={FORM_ID} type="submit">
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
