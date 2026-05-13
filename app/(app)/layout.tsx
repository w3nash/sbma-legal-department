"use client";

import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import {
  AppBreadcrumb,
  AppBreadcrumbProvider,
} from "@/components/AppBreadcrumb";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppBreadcrumbProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <AppBreadcrumb />
            </header>
            <main className="flex flex-1 flex-col overflow-hidden p-6">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AppBreadcrumbProvider>
      <Toaster position="top-center" />
    </QueryProvider>
  );
}
