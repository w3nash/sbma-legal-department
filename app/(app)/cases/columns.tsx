"use client";

import Link from "next/link";
import { ColumnDef, FilterFn } from "@tanstack/react-table";
import { RiArrowRightSLine } from "@remixicon/react";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { LegalFolderIcon } from "@/components/cases/CaseCard";

export type CaseRow = {
  id: string;
  title: string;
  caseNumber: string | null;
  status: string;
  documentCount: number;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; folder: string }> = {
  open: { label: "Open", folder: "text-primary" },
  closed: { label: "Closed", folder: "text-slate-400 dark:text-slate-500" },
  archived: { label: "Archived", folder: "text-amber-600/90" },
};

const titleAndCaseNumberFilter: FilterFn<CaseRow> = (
  row,
  columnId,
  filterValue: string
) => {
  const title = (row.getValue(columnId) as string).toLowerCase();
  const caseNumber = (row.original.caseNumber ?? "").toLowerCase();
  const search = filterValue.toLowerCase();
  return title.includes(search) || caseNumber.includes(search);
};

export const columns: ColumnDef<CaseRow>[] = [
  {
    accessorKey: "title",
    filterFn: titleAndCaseNumberFilter,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Case" />
    ),
    cell: ({ row }) => {
      const { id, title, caseNumber, status } = row.original;
      const cfg = statusConfig[status] ?? statusConfig.open;
      return (
        <Link href={`/cases/${id}`} className="group flex items-center gap-3">
          <div className={`shrink-0 ${cfg.folder}`}>
            <LegalFolderIcon className="h-auto w-8" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium group-hover:underline">
              {title}
            </p>
            {caseNumber && (
              <p className="font-mono text-[11px] text-muted-foreground/70">
                {caseNumber}
              </p>
            )}
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const cfg = statusConfig[status] ?? statusConfig.open;
      return (
        <span className="text-sm text-muted-foreground capitalize">
          {cfg.label}
        </span>
      );
    },
  },
  {
    accessorKey: "documentCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Documents" />
    ),
    cell: ({ row }) => {
      const count = row.getValue("documentCount") as number;
      return (
        <span className="text-sm text-muted-foreground">
          {count} {count === 1 ? "doc" : "docs"}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as string;
      return (
        <span className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
  },
  {
    id: "actions",
    cell: () => (
      <div className="flex justify-end text-muted-foreground/30">
        <RiArrowRightSLine className="size-4" />
      </div>
    ),
  },
];
