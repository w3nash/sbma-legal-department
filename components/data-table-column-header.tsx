"use client";

import { Column } from "@tanstack/react-table";
import { RiArrowUpLine, RiArrowDownLine, RiArrowUpDownLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{title}</span>
      {column.getIsSorted() === "desc" ? (
        <RiArrowDownLine className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "asc" ? (
        <RiArrowUpLine className="ml-2 h-4 w-4" />
      ) : (
        <RiArrowUpDownLine className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}
