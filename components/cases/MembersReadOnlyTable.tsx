"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
}

export function MembersReadOnlyTable({ members }: { members: Member[] }) {
  const columns = useMemo<ColumnDef<Member>[]>(
    () => [
      {
        id: "member",
        accessorFn: (row) => row.user.name,
        header: "Member",
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
          <span className="text-sm capitalize">{row.original.role}</span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={members}
      searchColumn="member"
      searchPlaceholder="Search members…"
    />
  );
}
