import Link from "next/link";
import { RiArrowRightSLine } from "@remixicon/react";

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
    <svg
      className={className}
      viewBox="0 0 72 60"
      fill="none"
      aria-hidden="true"
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
      {/* Scales watermark — top ornament */}
      <circle cx="36" cy="26" r="2" fill="white" fillOpacity="0.28" />
      {/* Pole */}
      <rect
        x="35"
        y="27.5"
        width="2"
        height="16"
        rx="1"
        fill="white"
        fillOpacity="0.28"
      />
      {/* Beam */}
      <rect
        x="22"
        y="31.5"
        width="28"
        height="2"
        rx="1"
        fill="white"
        fillOpacity="0.28"
      />
      {/* Base */}
      <rect
        x="28"
        y="45"
        width="16"
        height="2"
        rx="1"
        fill="white"
        fillOpacity="0.28"
      />
      {/* Left strings */}
      <line
        x1="25.5"
        y1="33"
        x2="21"
        y2="43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="25.5"
        y1="33"
        x2="30"
        y2="43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Left pan */}
      <path
        d="M19 43 Q25.5 50 32 43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <line
        x1="19"
        y1="43"
        x2="32"
        y2="43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Right strings */}
      <line
        x1="46.5"
        y1="33"
        x2="42"
        y2="43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="46.5"
        y1="33"
        x2="51"
        y2="43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Right pan */}
      <path
        d="M40 43 Q46.5 50 53 43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="43"
        x2="53"
        y2="43"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
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
