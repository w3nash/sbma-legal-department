"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Route, UserRole } from "@/lib/constants";
import { useAuthUser } from "@/components/AuthProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RiFolder3Line,
  RiTeamLine,
  RiShieldCheckLine,
  RiLogoutBoxRLine,
  RiArrowDownSLine,
} from "@remixicon/react";
import { initials } from "@/lib/utils";

export function AppSidebar() {
  const user = useAuthUser();
  const isAdmin = user?.role === UserRole.Admin;
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link href={Route.Home}>
                  <Image
                    src="/sbma-logo.png"
                    alt="SBMA Logo"
                    width={32}
                    height={32}
                    className="shrink-0 rounded"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      SBMA Legal Affairs
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Case Document Management
                    </span>
                  </div>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === Route.Cases}
                  tooltip="Cases"
                  render={
                    <Link href={Route.Cases}>
                      <RiFolder3Line className="size-4" />
                      <span>Cases</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === Route.AdminUsers}
                    tooltip="Users"
                    render={
                      <Link href={Route.AdminUsers}>
                        <RiTeamLine className="size-4" />
                        <span>Users</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === Route.AdminAuditLogs}
                    tooltip="Audit Logs"
                    render={
                      <Link href={Route.AdminAuditLogs}>
                        <RiShieldCheckLine className="size-4" />
                        <span>Audit Logs</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {user === undefined ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="grid flex-1 gap-1">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.image ?? ""} alt={user?.name} />
                    <AvatarFallback className="rounded-lg">
                      {user?.name ? initials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <RiArrowDownSLine className="ml-auto size-4 transition-transform group-data-[collapsible=icon]:hidden [[data-popup-open]_&]:rotate-180" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-full">
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      window.location.href = Route.Login;
                    }}
                  >
                    <RiLogoutBoxRLine className="size-4 fill-destructive" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
