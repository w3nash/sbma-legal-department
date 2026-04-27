"use client";

import { useMemo, useState } from "react";
import { type ColumnDef, type FilterFn } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddMembersSheet } from "@/components/cases/AddMembersSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MembershipRole } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { RiDeleteBinLine, RiTeamFill } from "@remixicon/react";
import {
  useCaseMembersQuery,
  useRemoveCaseMemberMutation,
  useUpdateMemberRoleMutation,
  type CaseMemberRow,
} from "@/hooks/use-cases";

const memberFilter: FilterFn<CaseMemberRow> = (
  row,
  _columnId,
  filterValue: string
) => {
  const search = filterValue.toLowerCase();
  const { name, email } = row.original.user;
  return (
    name.toLowerCase().includes(search) || email.toLowerCase().includes(search)
  );
};

function RemoveMemberAction({
  caseId,
  member,
}: {
  caseId: string;
  member: CaseMemberRow;
}) {
  const [open, setOpen] = useState(false);
  const removeMutation = useRemoveCaseMemberMutation(caseId);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <RiDeleteBinLine className="size-4" />
        <span className="sr-only">Remove {member.user.name}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to remove <strong>{member.user.name}</strong> from
            this case.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md bg-accent p-3">
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>They will lose access to all documents in this case</li>
            <li>They can be re-added at any time</li>
          </ul>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              removeMutation.mutate(member.user.id);
              setOpen(false);
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CaseMembersContent({ caseId }: { caseId: string }) {
  const { data: members = [] } = useCaseMembersQuery(caseId);
  const updateRoleMutation = useUpdateMemberRoleMutation(caseId);

  const columns = useMemo<ColumnDef<CaseMemberRow>[]>(
    () => [
      {
        accessorKey: "user",
        header: "Member",
        filterFn: memberFilter,
        cell: ({ row }) => {
          const { name, email } = row.original.user;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar size="sm">
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-[12px] text-muted-foreground">{email}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Select
            value={row.original.role}
            onValueChange={(v) => {
              if (v)
                updateRoleMutation.mutate({
                  userId: row.original.user.id,
                  role: v,
                });
            }}
          >
            <SelectTrigger size="sm" className="w-[120px]">
              {row.original.role === MembershipRole.Uploader
                ? "Uploader"
                : "Viewer"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MembershipRole.Viewer}>Viewer</SelectItem>
              <SelectItem value={MembershipRole.Uploader}>Uploader</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RemoveMemberAction caseId={caseId} member={row.original} />
          </div>
        ),
      },
    ],
    [caseId, updateRoleMutation]
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {members.length === 0 ? (
        <>
          <div className="flex shrink-0 justify-end">
            <AddMembersSheet caseId={caseId} />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <div
              className="mb-6 flex h-[72px] w-[72px] animate-in items-center justify-center rounded-2xl border border-chart-2/15 text-chart-2 duration-700 fill-mode-both zoom-in-95 fade-in"
              style={{
                background:
                  "color-mix(in oklch, var(--chart-2) 7%, transparent)",
                backgroundImage:
                  "radial-gradient(circle, color-mix(in oklch, var(--chart-2) 20%, transparent) 1px, transparent 1px)",
                backgroundSize: "10px 10px",
                backgroundPosition: "3px 3px",
              }}
            >
              <RiTeamFill className="size-10" />
            </div>

            <div className="mb-4 flex animate-in items-center gap-3 delay-150 duration-500 fill-mode-both fade-in">
              <div className="h-px w-10 bg-border" />
              <div className="h-[5px] w-[5px] rotate-45 bg-chart-2/35" />
              <div className="h-px w-10 bg-border" />
            </div>

            <div className="animate-in space-y-1.5 delay-200 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-muted-foreground/55 uppercase">
                Case Members
              </p>
              <h2 className="text-base font-semibold tracking-tight">
                No members assigned
              </h2>
            </div>

            <div className="mt-2 animate-in delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
              <p className="max-w-[240px] text-sm leading-relaxed text-muted-foreground">
                Add team members to grant them access to this case.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1">
          <DataTable
            columns={columns}
            data={members}
            defaultPageSize={10}
            searchColumn="user"
            searchPlaceholder="Search by name or email…"
            actions={<AddMembersSheet caseId={caseId} />}
          />
        </div>
      )}
    </div>
  );
}
