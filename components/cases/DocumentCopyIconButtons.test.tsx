import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const useQueryClientMock = vi.hoisted(() =>
  vi.fn(() => ({ invalidateQueries: invalidateQueriesMock }))
);
const performDocumentCopyActionMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: useQueryClientMock,
}));

vi.mock("@/lib/document-copy-client", () => ({
  performDocumentCopyAction: performDocumentCopyActionMock,
}));

describe("DocumentCopyIconButtons", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("uses the same icon button size as the viewer toolbar controls", async () => {
    const { DocumentCopyIconButtons } = await import("./DocumentCopyIconButtons");
    const html = renderToStaticMarkup(
      <DocumentCopyIconButtons
        caseId="case-1"
        documentId="doc-1"
        filename="Pleading.pdf"
      />
    );

    expect(html).toContain('aria-label="Print document"');
    expect(html).toContain('aria-label="Download document"');
    expect(html).toContain("size-8");
    expect(html).not.toContain("size-9");
  });
});
