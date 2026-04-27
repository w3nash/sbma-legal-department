"use client";

import Link from "next/link";
import { RiAddLine } from "@remixicon/react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Route } from "@/lib/constants";
import { columns } from "./columns";
import type { UserRow } from "./columns";

interface UsersDataTableProps {
  data: UserRow[];
}

export function UsersDataTable({ data }: UsersDataTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      defaultPageSize={10}
      searchColumn="name"
      searchPlaceholder="Search by name..."
      actions={
        <Link href={Route.AdminUsersCreate}>
          <Button>
            <RiAddLine className="mr-1 size-4" />
            Create User
          </Button>
        </Link>
      }
    />
  );
}
