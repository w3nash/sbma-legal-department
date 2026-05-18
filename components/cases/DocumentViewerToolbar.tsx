"use client";

import type { ReactElement } from "react";
import {
  RiInformationLine,
  RiMenuLine,
  RiRefreshLine,
  RiZoomInLine,
  RiZoomOutLine,
} from "@remixicon/react";
import { DocumentCopyIconButtons } from "@/components/cases/DocumentCopyIconButtons";
import { Button } from "@/components/ui/button";

const toolbarIconButtonClassName =
  "text-white hover:bg-white/10 hover:text-white";

type DocumentViewerToolbarProps = {
  caseId: string;
  currentPage: number;
  documentId: string;
  downloadAvailable: boolean;
  filename: string;
  numPages: number;
  onRotate: () => void;
  onToggleDetails: () => void;
  onToggleSidebar: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoomPercent: number;
};

export function DocumentViewerToolbar({
  caseId,
  currentPage,
  documentId,
  downloadAvailable,
  filename,
  numPages,
  onRotate,
  onToggleDetails,
  onToggleSidebar,
  onZoomIn,
  onZoomOut,
  zoomPercent,
}: DocumentViewerToolbarProps): ReactElement {
  const pageTotal = numPages > 0 ? numPages : "—";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#2b2b2b] px-3 text-sm text-white shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={toolbarIconButtonClassName}
        onClick={onToggleSidebar}
        aria-label="Toggle thumbnails"
        title="Toggle thumbnails"
      >
        <RiMenuLine className="size-5" />
      </Button>

      <div className="hidden min-w-0 flex-1 font-medium sm:block">
        <span className="block truncate">{filename}</span>
      </div>

      <span className="sr-only">
        {currentPage} / {pageTotal}
      </span>

      <div
        aria-hidden="true"
        className="hidden items-center gap-2 font-mono text-base sm:flex"
      >
        <span className="rounded bg-black/30 px-2 py-1">{currentPage}</span>
        <span className="text-white/70">/</span>
        <span>{pageTotal}</span>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-white/20 md:block" />

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolbarIconButtonClassName}
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <RiZoomOutLine className="size-5" />
        </Button>
        <span className="min-w-16 rounded bg-black/30 px-2 py-1 text-center font-mono text-base">
          {zoomPercent}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolbarIconButtonClassName}
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <RiZoomInLine className="size-5" />
        </Button>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-white/20 md:block" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={toolbarIconButtonClassName}
        onClick={onRotate}
        aria-label="Rotate document"
        title="Rotate document"
      >
        <RiRefreshLine className="size-5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={toolbarIconButtonClassName}
        onClick={onToggleDetails}
        aria-label="Document details"
        title="Document details"
      >
        <RiInformationLine className="size-5" />
      </Button>

      <div className="flex items-center gap-1">
        {downloadAvailable ? (
          <DocumentCopyIconButtons
            caseId={caseId}
            documentId={documentId}
            filename={filename}
          />
        ) : null}
      </div>
    </header>
  );
}
