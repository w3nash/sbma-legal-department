"use client";

import { useState } from "react";
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
import { UploadDocumentsForm } from "@/components/cases/UploadDocumentsForm";

const FORM_ID = "upload-documents-sheet-form";

export function UploadDocumentsSheet({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Upload Documents</SheetTitle>
          <SheetDescription>
            Add one or more files. They will appear immediately and finish
            processing in the background.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-0">
          <UploadDocumentsForm
            caseId={caseId}
            formId={FORM_ID}
            hideSubmit
            onUploadingChange={setUploading}
          />
        </div>
        <SheetFooter className="grid grid-cols-2">
          <SheetClose
            render={<Button variant="outline" disabled={uploading} />}
          >
            Cancel
          </SheetClose>
          <Button type="submit" form={FORM_ID} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
