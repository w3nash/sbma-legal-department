"use client";

import { useRouter } from "next/navigation";
import { CaseSettingsSheet } from "@/components/cases/CaseSettingsSheet";

interface Props {
  caseId: string;
  title: string;
  caseNumber: string | null;
  description: string | null;
  status: string;
}

export function CaseSettingsModalWrapper(props: Props) {
  const router = useRouter();
  return (
    <CaseSettingsSheet
      {...props}
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    />
  );
}
