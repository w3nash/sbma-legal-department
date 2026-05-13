import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppBreadcrumb,
  AppBreadcrumbProvider,
} from "@/components/AppBreadcrumb";

const usePathnameMock = vi.hoisted(() => vi.fn());
const useParamsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useParams: useParamsMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AppBreadcrumb", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders a generic document breadcrumb in the app header for document detail routes", () => {
    usePathnameMock.mockReturnValue("/cases/case-1/documents/doc-1");
    useParamsMock.mockReturnValue({ caseId: "case-1" });

    const html = renderToStaticMarkup(
      <AppBreadcrumbProvider>
        <AppBreadcrumb />
      </AppBreadcrumbProvider>
    );

    expect(html).toContain("Cases");
    expect(html).toContain("Documents");
    expect(html).toContain("Document");
  });

  it("renders custom header breadcrumb segments when provided", () => {
    usePathnameMock.mockReturnValue("/cases/case-1/documents/doc-1");
    useParamsMock.mockReturnValue({ caseId: "case-1" });

    const html = renderToStaticMarkup(
      <AppBreadcrumbProvider
        initialSegments={[
          { label: "Cases", href: "/cases" },
          { label: "Documents", href: "/cases/case-1" },
          { label: "1765409235008-TRIAL BRIEF.pdf" },
        ]}
      >
        <AppBreadcrumb />
      </AppBreadcrumbProvider>
    );

    expect(html).toContain("1765409235008-TRIAL BRIEF.pdf");
    expect(html).not.toContain(">Document<");
    expect(html).toContain(
      'data-slot="breadcrumb" class="min-w-0 flex-1 overflow-hidden"'
    );
    expect(html).toContain(
      'data-slot="breadcrumb-list" class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground min-w-0 flex-nowrap overflow-hidden"'
    );
    expect(html).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    );
    expect(html).toContain(
      'data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class="font-normal text-foreground block truncate"'
    );
  });
});
