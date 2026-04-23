"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Route, UserRole } from "@/lib/constants";
import { useAuthUser } from "./AuthProvider";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RiFolder3Line,
  RiTeamLine,
  RiShieldCheckLine,
  RiLogoutBoxRLine,
  RiUserLine,
} from "@remixicon/react";

export function AppSidebar() {
  const user = useAuthUser();
  const isAdmin = user?.role === UserRole.Admin;
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.image ?? ""} alt={user?.name} />
                      <AvatarFallback className="rounded-lg">
                        {user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name ?? "Guest"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem
                  render={
                    <Link href={Route.Profile}>
                      <RiUserLine className="mr-2 size-4" />
                      Profile
                    </Link>
                  }
                />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    window.location.href = Route.Login;
                  }}
                >
                  <RiLogoutBoxRLine className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
