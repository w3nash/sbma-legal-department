"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { UserRole, formatRole } from "@/lib/constants";
import { ToggleActiveSwitch } from "@/components/admin/ToggleActiveSwitch";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean | null;
};

export const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant={role === UserRole.Admin ? "default" : "secondary"}>
          {formatRole(role)}
        </Badge>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <ToggleActiveSwitch
          userId={user.id}
          isActive={Boolean(user.isActive)}
          userName={user.name}
        />
      );
    },
  },
];
