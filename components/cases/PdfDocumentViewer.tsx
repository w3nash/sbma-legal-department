"use client";

import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { DocumentViewerDetailsDrawer } from "@/components/cases/DocumentViewerDetailsDrawer";
import { DocumentViewerThumbnails } from "@/components/cases/DocumentViewerThumbnails";
import { DocumentViewerToolbar } from "@/components/cases/DocumentViewerToolbar";
import type { DocumentDetailData } from "@/lib/document-detail";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const minZoom = 0.5;
const maxZoom = 2;
const zoomStep = 0.25;
const initialPageWidth = 280;
const maxPageWidth = 760;
const pageWidthPadding = 48;
const desktopDetailsMediaQuery = "(min-width: 768px)";

type PageElementMap = Map<number, HTMLDivElement>;

function clampZoom(value: number): number {
  return Math.min(Math.max(value, minZoom), maxZoom);
}

function getPages(numPages: number): number[] {
  return Array.from({ length: numPages }, (_, index) => index + 1);
}

function getInitialDetailsOpen(initialDetailsOpen: boolean): boolean {
  if (typeof window === "undefined") return initialDetailsOpen;

  return window.matchMedia(desktopDetailsMediaQuery).matches && initialDetailsOpen;
}

type PdfDocumentViewerProps = {
  caseId: string;
  data: DocumentDetailData;
  documentId: string;
  initialDetailsOpen?: boolean;
  initialNumPages?: number;
  initialSidebarOpen?: boolean;
};

export function PdfDocumentViewer({
  caseId,
  data,
  documentId,
  initialDetailsOpen = true,
  initialNumPages = 0,
  initialSidebarOpen = true,
}: PdfDocumentViewerProps): ReactElement {
  const [numPages, setNumPages] = useState(initialNumPages);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialSidebarOpen);
  const [isDetailsOpen, setIsDetailsOpen] = useState(() =>
    getInitialDetailsOpen(initialDetailsOpen)
  );
  const [pageWidth, setPageWidth] = useState(initialPageWidth);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElementsRef = useRef<PageElementMap>(new Map());
  const viewerUrl = `/api/documents/${documentId}/viewer`;
  const pages = getPages(numPages);
  const updatePageWidth = useCallback((container: HTMLDivElement | null) => {
    scrollContainerRef.current = container;
    if (!container) return;

    const calculatePageWidth = () => {
      const availableWidth = Math.max(container.clientWidth - pageWidthPadding, 1);
      const nextPageWidth = Math.min(maxPageWidth, availableWidth);

      setPageWidth((currentWidth) => {
        if (currentWidth === nextPageWidth) {
          return currentWidth;
        }

        return nextPageWidth;
      });
    };

    calculatePageWidth();
    const resizeObserver = new ResizeObserver(calculatePageWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  function jumpToPage(pageNumber: number): void {
    setCurrentPage(pageNumber);
    pageElementsRef.current.get(pageNumber)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function updateCurrentPageFromScroll(): void {
    const container = scrollContainerRef.current;
    if (!container || pageElementsRef.current.size === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    const targetY = containerTop + 96;
    let closestPage = currentPage;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const [pageNumber, element] of pageElementsRef.current.entries()) {
      const distance = Math.abs(element.getBoundingClientRect().top - targetY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNumber;
      }
    }

    setCurrentPage((activePage) => {
      if (closestPage === activePage) {
        return activePage;
      }

      return closestPage;
    });
  }

  return (
    <section
      data-testid="pdf-document-viewer"
      className="flex h-[calc(100vh-8rem)] min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden border bg-[#202124] text-white"
    >
      <DocumentViewerToolbar
        caseId={caseId}
        currentPage={currentPage}
        documentId={documentId}
        downloadAvailable={data.downloadAvailable}
        filename={data.originalFilename}
        numPages={numPages}
        onRotate={() => setRotation((value) => (value + 90) % 360)}
        onToggleDetails={() => setIsDetailsOpen((value) => !value)}
        onToggleSidebar={() => setIsSidebarOpen((value) => !value)}
        onZoomIn={() => setZoom((value) => clampZoom(value + zoomStep))}
        onZoomOut={() => setZoom((value) => clampZoom(value - zoomStep))}
        zoomPercent={Math.round(zoom * 100)}
      />

      <Document
        file={viewerUrl}
        className="min-h-0 flex-1 overflow-hidden"
        onLoadSuccess={({ numPages: nextNumPages }) => {
          setNumPages(nextNumPages);
          setCurrentPage(1);
        }}
        loading={
          <div className="flex min-h-[28rem] flex-1 items-center justify-center text-sm text-white/70">
            Loading PDF viewer...
          </div>
        }
        error={
          <div className="flex min-h-[28rem] flex-1 items-center justify-center p-6 text-center text-sm text-white/80">
            Unable to load PDF viewer.
          </div>
        }
        noData={
          <div className="flex min-h-[28rem] flex-1 items-center justify-center p-6 text-center text-sm text-white/80">
            No PDF file is available for this document.
          </div>
        }
      >
        <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
          {isSidebarOpen && numPages > 0 ? (
            <DocumentViewerThumbnails
              currentPage={currentPage}
              numPages={numPages}
              onSelectPage={jumpToPage}
            />
          ) : null}

          <div
            ref={updatePageWidth}
            data-testid="pdf-page-scroll"
            className="h-full min-w-0 flex-1 overflow-auto bg-[#202124] p-6"
            onScroll={updateCurrentPageFromScroll}
          >
            <div className="mx-auto flex w-full min-w-0 flex-col items-center gap-6">
              {pages.map((pageNumber) => (
                <div
                  key={pageNumber}
                  ref={(element) => {
                    if (element) {
                      pageElementsRef.current.set(pageNumber, element);
                    } else {
                      pageElementsRef.current.delete(pageNumber);
                    }
                  }}
                  data-testid={`pdf-page-frame-${pageNumber}`}
                  className="max-w-full overflow-auto bg-transparent"
                >
                  <div
                    data-testid={`pdf-page-surface-${pageNumber}`}
                    className="bg-white shadow-2xl"
                    style={{
                      width: `${pageWidth * zoom}px`,
                    }}
                  >
                    <Page
                      pageNumber={pageNumber}
                      renderAnnotationLayer
                      renderTextLayer
                      rotate={rotation}
                      scale={1}
                      width={pageWidth * zoom}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isDetailsOpen ? (
            <DocumentViewerDetailsDrawer
              data={data}
              onClose={() => setIsDetailsOpen(false)}
            />
          ) : null}
        </div>
      </Document>
    </section>
  );
}
