import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

describe("CaseDetailShell", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("keeps the case header and tabs on ordinary case pages", async () => {
    usePathnameMock.mockReturnValue("/cases/case-1/members");

    const { CaseDetailShell } = await import("./CaseDetailShell");
    const html = renderToStaticMarkup(
      <CaseDetailShell
        caseHeader={<div>Case header</div>}
        caseTabs={<nav>Case tabs</nav>}
        modal={<div>Modal content</div>}
      >
        <section>Page content</section>
      </CaseDetailShell>
    );

    expect(html).toContain("Case header");
    expect(html).toContain("Case tabs");
    expect(html).toContain("Page content");
    expect(html).toContain("Modal content");
  });

  it("hides the case header and tabs on document detail pages", async () => {
    usePathnameMock.mockReturnValue("/cases/case-1/documents/doc-1");

    const { CaseDetailShell } = await import("./CaseDetailShell");
    const html = renderToStaticMarkup(
      <CaseDetailShell
        caseHeader={<div>Case header</div>}
        caseTabs={<nav>Case tabs</nav>}
        modal={<div>Modal content</div>}
      >
        <section>Viewer content</section>
      </CaseDetailShell>
    );

    expect(html).not.toContain("Case header");
    expect(html).not.toContain("Case tabs");
    expect(html).toContain("Viewer content");
    expect(html).toContain("Modal content");
  });
});
