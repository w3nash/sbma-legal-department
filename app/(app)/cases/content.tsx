"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseCard } from "@/components/cases/CaseCard";
import { CasesEmptyState } from "@/components/cases/CasesEmptyState";
import { columns } from "./columns";
import { useCasesQuery } from "@/hooks/use-cases";
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiGridLine,
  RiListView,
  RiSearchLine,
} from "@remixicon/react";

type ViewMode = "grid" | "list";

function CasesListSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="aspect-3/4 rounded-lg" />
      ))}
    </div>
  );
}

export function CasesContent({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { data: cases = [], isLoading, error } = useCasesQuery();
  const [view, setView] = useState<ViewMode>("grid");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 24 });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: cases,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { columnFilters, sorting, pagination },
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Cases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and manage all legal cases.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading ? (
        <CasesListSkeleton />
      ) : cases.length === 0 ? (
        <CasesEmptyState isAdmin={isAdmin} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Toolbar: search + view toggle */}
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="relative w-full max-w-sm">
              <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title or case number..."
                value={
                  (table.getColumn("title")?.getFilterValue() as string) ?? ""
                }
                onChange={(e) =>
                  table.getColumn("title")?.setFilterValue(e.target.value)
                }
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Button
                  variant={view === "grid" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                >
                  <RiGridLine />
                </Button>
                <Button
                  variant={view === "list" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                >
                  <RiListView />
                </Button>
              </div>
              {isAdmin && (
                <Button
                  nativeButton={false}
                  render={<Link href="/cases/new" />}
                >
                  <RiAddLine className="mr-1 size-4" />
                  New Case
                </Button>
              )}
            </div>
          </div>

          {/* Grid view */}
          {view === "grid" ? (
            <div className="grid min-h-0 flex-1 animate-in grid-cols-2 content-start gap-1 overflow-auto duration-200 fade-in sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <CaseCard key={row.id} {...row.original} view="grid" />
                ))
              ) : (
                <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No cases match your search.
                </p>
              )}
            </div>
          ) : (
            /* List / table view */
            <div className="min-h-0 flex-1 animate-in overflow-auto rounded-md border duration-200 fade-in">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/cases/${row.original.id}`)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No cases match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex shrink-0 items-center justify-between px-1">
            <p className="text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length}{" "}
              {table.getFilteredRowModel().rows.length === 1 ? "case" : "cases"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Previous page</span>
                <RiArrowLeftSLine className="h-4 w-4" />
              </Button>
              <span className="flex w-[100px] items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Next page</span>
                <RiArrowRightSLine className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
