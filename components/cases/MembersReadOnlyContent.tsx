"use client";

import { useCaseMembersQuery } from "@/hooks/use-cases";
import type { CaseMemberRow } from "@/hooks/use-cases";
import { MembersReadOnlyTable } from "@/components/cases/MembersReadOnlyTable";

export function MembersReadOnlyContent({
  caseId,
  initialMembers,
}: {
  caseId: string;
  initialMembers: CaseMemberRow[];
}) {
  const { data: members = initialMembers, error } = useCaseMembersQuery(caseId);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  return <MembersReadOnlyTable members={members} />;
}
