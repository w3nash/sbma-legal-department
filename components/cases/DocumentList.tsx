"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  FilterFn,
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentEmptyState } from "@/components/cases/DocumentEmptyState";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiFileTextLine,
  RiGridLine,
  RiListView,
  RiSearchLine,
  RiUploadLine,
} from "@remixicon/react";

export interface DocumentRow {
  id: string;
  controlNumber: string;
  originalFilename: string;
  createdAt: Date;
  fileSizeBytes: number | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const documentFilter: FilterFn<DocumentRow> = (
  row,
  _columnId,
  filterValue: string
) => {
  const filename = row.original.originalFilename.toLowerCase();
  const controlNumber = row.original.controlNumber.toLowerCase();
  const search = filterValue.toLowerCase();
  return filename.includes(search) || controlNumber.includes(search);
};

function DocumentCard({ doc, caseId }: { doc: DocumentRow; caseId: string }) {
  const dateLabel = new Date(doc.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/cases/${caseId}/documents/${doc.id}`} className="group block">
      <div className="flex flex-col items-center rounded-xl p-3 transition-colors hover:bg-accent">
        <div className="mb-2.5 text-primary/70">
          <RiFileTextLine className="size-14" />
        </div>
        <div className="w-full space-y-0.5 text-center">
          <p className="line-clamp-2 text-[12.5px] leading-snug font-medium">
            {doc.originalFilename}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/60">
            {doc.controlNumber}
          </p>
          <p className="text-[10px] text-muted-foreground/45">{dateLabel}</p>
        </div>
      </div>
    </Link>
  );
}

export function DocumentList({
  documents,
  caseId,
  canUpload,
}: {
  documents: DocumentRow[];
  caseId: string;
  canUpload: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("list");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        accessorKey: "originalFilename",
        filterFn: documentFilter,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Document" />
        ),
        cell: ({ row }) => {
          const { id, originalFilename, controlNumber } = row.original;
          return (
            <Link
              href={`/cases/${caseId}/documents/${id}`}
              className="group flex items-center gap-3"
            >
              <RiFileTextLine className="size-8 shrink-0 text-primary/70" />
              <div className="min-w-0">
                <p className="truncate font-medium group-hover:underline">
                  {originalFilename}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground/70">
                  {controlNumber}
                </p>
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.getValue<Date>("createdAt")).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              }
            )}
          </span>
        ),
      },
      {
        accessorKey: "fileSizeBytes",
        header: "Size",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatBytes(Number(row.getValue("fileSizeBytes") ?? 0))}
          </span>
        ),
      },
      {
        id: "actions",
        cell: () => (
          <div className="flex justify-end text-muted-foreground/30">
            <RiArrowRightSLine className="size-4" />
          </div>
        ),
      },
    ],
    [caseId]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: documents,
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

  if (documents.length === 0) {
    return <DocumentEmptyState canUpload={canUpload} caseId={caseId} />;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="relative max-w-sm">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename or control number…"
            value={
              (table
                .getColumn("originalFilename")
                ?.getFilterValue() as string) ?? ""
            }
            onChange={(e) =>
              table
                .getColumn("originalFilename")
                ?.setFilterValue(e.target.value)
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
          {canUpload && (
            <Button onClick={() => router.push(`/cases/${caseId}/upload`)}>
              <RiUploadLine className="mr-1 size-4" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {/* Grid view */}
      {view === "grid" ? (
        <div className="grid min-h-0 flex-1 animate-in grid-cols-2 content-start gap-1 overflow-auto duration-200 fade-in sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.length > 0 ? (
            rows.map((row) => (
              <DocumentCard key={row.id} doc={row.original} caseId={caseId} />
            ))
          ) : (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No documents match your search.
            </p>
          )}
        </div>
      ) : (
        /* List view */
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
                    onClick={() =>
                      router.push(
                        `/cases/${caseId}/documents/${row.original.id}`
                      )
                    }
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
                    No documents match your search.
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
          {table.getFilteredRowModel().rows.length === 1
            ? "document"
            : "documents"}
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
  );
}
