"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/components/AppSidebar";
import { QueryProvider } from "@/app/components/QueryProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <SidebarProvider>
        <div className="flex min-h-svh w-full">
          <AppSidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </SidebarProvider>
    </QueryProvider>
  );
}
