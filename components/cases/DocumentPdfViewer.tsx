"use client";

import { useEffect, useRef, useState } from "react";
import { pdfjs, Document, Page } from "react-pdf";
import { RiAddLine, RiSubtractLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.75;
const MAX_SCALE = 2;
const SCALE_STEP = 0.25;

type DocumentPdfViewerProps = {
  src: string;
  title: string;
};

export function DocumentPdfViewer({
  src,
  title,
}: DocumentPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setNumPages(null);
    setScale(1);
    setLoadError(null);
  }, [src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const paperWidth = Math.min(Math.max(containerWidth - 24, 0), 816);
  const pageWidth = paperWidth > 0 ? Math.floor(paperWidth) : 816;
  const renderedPages = numPages ? Array.from({ length: numPages }, (_, index) => index + 1) : [];

  return (
    <div className="flex min-h-[24rem] flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <span className="min-w-24 text-sm text-muted-foreground">
          {numPages ? `${numPages} pages` : "Preparing pages"}
        </span>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() =>
              setScale((current) => Math.max(MIN_SCALE, current - SCALE_STEP))
            }
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <RiSubtractLine className="size-4" />
          </Button>
          <span className="min-w-14 text-center text-sm text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() =>
              setScale((current) => Math.min(MAX_SCALE, current + SCALE_STEP))
            }
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <RiAddLine className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-[24rem] flex-1 items-start justify-center overflow-auto rounded-lg border bg-muted/10 p-3"
      >
        {loadError ? (
          <div className="flex min-h-[20rem] max-w-md items-center justify-center text-center">
            <div className="space-y-2">
              <p className="font-medium">The viewer could not load this PDF.</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {loadError}
              </p>
            </div>
          </div>
        ) : (
          <Document
            file={src}
            loading={
              <div className="mx-auto w-full max-w-[8.5in] rounded-md border border-border/80 bg-white p-6 shadow-sm">
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Loading viewer copy...
                </p>
              </div>
            }
            onLoadSuccess={({ numPages: loadedPages }) => {
              setLoadError(null);
              setNumPages(loadedPages);
            }}
            onLoadError={(error) => {
              setNumPages(null);
              setLoadError(error.message);
            }}
          >
            <div className="mx-auto flex w-full max-w-[8.5in] flex-col gap-6">
              {renderedPages.map((pageNumber) => (
                <div
                  key={`${src}-${pageNumber}-${scale}-${pageWidth}`}
                  className="mx-auto w-full max-w-[8.5in] rounded-md border border-border/80 bg-white p-3 shadow-sm"
                >
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth}
                    scale={scale}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    loading={
                      <p className="py-12 text-center text-sm text-muted-foreground">
                        Rendering page...
                      </p>
                    }
                    className="mx-auto"
                    canvasBackground="white"
                  />
                </div>
              ))}
            </div>
          </Document>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Read-only viewer for {title}
      </p>
    </div>
  );
}
