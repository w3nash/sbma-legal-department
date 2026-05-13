"use client";

import { Thumbnail } from "react-pdf";
import { cn } from "@/lib/utils";

export function DocumentViewerThumbnails({
  currentPage,
  numPages,
  onSelectPage,
}: {
  currentPage: number;
  numPages: number;
  onSelectPage: (pageNumber: number) => void;
}) {
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);

  return (
    <aside
      data-testid="pdf-thumbnail-sidebar"
      className="absolute inset-y-0 left-0 z-10 h-full w-36 shrink-0 overflow-y-auto border-r border-white/10 bg-[#191c20] p-3 text-white shadow-2xl md:static md:z-auto md:shadow-none"
    >
      <div className="space-y-5">
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className="group flex w-full flex-col items-center gap-2 text-center"
            onClick={() => onSelectPage(pageNumber)}
            aria-label={`Go to page ${pageNumber}`}
          >
            <div
              className={cn(
                "overflow-hidden border-4 border-transparent bg-white shadow transition group-hover:border-blue-300",
                currentPage === pageNumber && "border-blue-400"
              )}
            >
              <Thumbnail pageNumber={pageNumber} width={96} />
            </div>
            <span className="text-sm font-semibold">{pageNumber}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
