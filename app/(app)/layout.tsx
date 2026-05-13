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
          <SidebarInset className="min-w-0 overflow-hidden">
            <header className="sticky top-0 z-10 flex h-14 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <AppBreadcrumb />
              </div>
            </header>
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AppBreadcrumbProvider>
      <Toaster position="top-center" />
    </QueryProvider>
  );
}
