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
          { label: "Pleading.pdf" },
        ]}
      >
        <AppBreadcrumb />
      </AppBreadcrumbProvider>
    );

    expect(html).toContain("Pleading.pdf");
    expect(html).not.toContain(">Document<");
  });
});
