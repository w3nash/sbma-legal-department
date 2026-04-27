"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";

export type AuditLogRow = {
  id: string;
  timestamp: Date;
  action: string;
  user: { name: string | null; email: string | null } | null;
  case: { title: string | null } | null;
  document: { controlNumber: string | null } | null;
  ipAddress: string | null;
};

export const columns: ColumnDef<AuditLogRow>[] = [
  {
    accessorKey: "timestamp",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as Date;
      return <span>{new Date(timestamp).toLocaleString()}</span>;
    },
  },
  {
    accessorKey: "action",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Action" />
    ),
  },
  {
    id: "user",
    header: "User",
    cell: ({ row }) => {
      const user = row.original.user;
      return <span>{user?.name ?? user?.email ?? "-"}</span>;
    },
  },
  {
    id: "case",
    header: "Case",
    cell: ({ row }) => {
      const c = row.original.case;
      return <span>{c?.title ?? "-"}</span>;
    },
  },
  {
    id: "document",
    header: "Document",
    cell: ({ row }) => {
      const doc = row.original.document;
      return (
        <span className="font-mono text-xs">
          {doc?.controlNumber ?? "-"}
        </span>
      );
    },
  },
  {
    accessorKey: "ipAddress",
    header: "IP",
  },
];
