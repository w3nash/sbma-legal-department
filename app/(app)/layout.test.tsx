import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button className={className}>Toggle sidebar</button>
  ),
  SidebarInset: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <main data-slot="sidebar-inset" className={className}>
      {children}
    </main>
  ),
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: () => <aside data-testid="app-sidebar">App sidebar</aside>,
}));

vi.mock("@/components/AppBreadcrumb", () => ({
  AppBreadcrumb: () => <nav data-testid="app-breadcrumb">Breadcrumb</nav>,
  AppBreadcrumbProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/QueryProvider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

describe("AppLayout", () => {
  it("constrains the sidebar inset, app header, and page content width", async () => {
    const { default: AppLayout } = await import("./layout");

    const html = renderToStaticMarkup(
      <AppLayout>
        <div>Page content</div>
      </AppLayout>
    );

    expect(html).toContain(
      'data-slot="sidebar-inset" class="min-w-0 overflow-hidden"'
    );
    expect(html).toContain(
      'class="sticky top-0 z-10 flex h-14 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b bg-background px-4"'
    );
    expect(html).toContain('class="min-w-0 flex-1 overflow-hidden"');
    expect(html).toContain(
      'class="flex min-w-0 flex-1 flex-col overflow-hidden p-6"'
    );
  });
});
