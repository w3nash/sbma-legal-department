import Link from "next/link";
import { RiArrowRightSLine, RiScales3Line } from "@remixicon/react";

interface CaseCardProps {
  id: string;
  title: string;
  caseNumber?: string | null;
  status: string;
  documentCount: number;
  createdAt: string | Date;
  view: "grid" | "list";
}

const statusConfig: Record<string, { label: string; folder: string }> = {
  open: { label: "Open", folder: "text-primary" },
  closed: { label: "Closed", folder: "text-slate-400 dark:text-slate-500" },
  archived: { label: "Archived", folder: "text-amber-600/90" },
};

export function LegalFolderIcon({
  className = "w-16 h-auto",
}: {
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 72 60"
        fill="none"
        aria-hidden="true"
        className="block h-auto w-full"
      >
        {/* Folder body */}
        <path
          d="M0 18 L0 10 Q0 4 6 4 L26 4 Q32 4 34 10 L37 16 L67 16 Q72 16 72 21 L72 55 Q72 60 67 60 L5 60 Q0 60 0 55 Z"
          fill="currentColor"
        />
        {/* Tab highlight */}
        <path
          d="M0 18 L0 10 Q0 4 6 4 L26 4 Q32 4 34 10 L37 16 L0 16 Z"
          fill="white"
          fillOpacity="0.12"
        />
      </svg>
      <RiScales3Line className="pointer-events-none absolute top-[62%] left-1/2 h-auto w-[50%] -translate-x-1/2 -translate-y-1/2 text-white opacity-30" />
    </div>
  );
}

export function CaseCard({
  id,
  title,
  caseNumber,
  status,
  documentCount,
  createdAt,
  view,
}: CaseCardProps) {
  const cfg = statusConfig[status] ?? statusConfig.open;
  const dateLabel = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (view === "list") {
    return (
      <Link
        href={`/cases/${id}`}
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
      >
        <div className={`shrink-0 ${cfg.folder}`}>
          <LegalFolderIcon className="h-auto w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          {caseNumber && (
            <p className="truncate font-mono text-[11px] text-muted-foreground/70">
              {caseNumber}
            </p>
          )}
        </div>
        <span className="w-16 shrink-0 text-xs text-muted-foreground capitalize">
          {cfg.label}
        </span>
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
          {documentCount} {documentCount === 1 ? "doc" : "docs"}
        </span>
        <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:block">
          {dateLabel}
        </span>
        <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  return (
    <Link href={`/cases/${id}`} className="group block">
      <div className="flex flex-col items-center rounded-xl p-3 transition-colors hover:bg-accent">
        <div className={`mb-2.5 ${cfg.folder}`}>
          <LegalFolderIcon className="h-auto w-16" />
        </div>
        <div className="w-full space-y-0.5 text-center">
          <p className="line-clamp-2 text-[12.5px] leading-snug font-medium">
            {title}
          </p>
          {caseNumber && (
            <p className="font-mono text-[10px] text-muted-foreground/60">
              {caseNumber}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/45">
            {documentCount} {documentCount === 1 ? "document" : "documents"}
          </p>
        </div>
      </div>
    </Link>
  );
}
