"use client";

import { usePathname } from "next/navigation";

interface CaseDetailShellProps {
  caseHeader: React.ReactNode;
  caseTabs: React.ReactNode;
  children: React.ReactNode;
  modal: React.ReactNode;
}

export function isCaseDocumentDetailPath(pathname: string): boolean {
  return /^\/cases\/[^/]+\/documents\/[^/]+(?:\/|$)/.test(pathname);
}

export function CaseDetailShell({
  caseHeader,
  caseTabs,
  children,
  modal,
}: CaseDetailShellProps) {
  const pathname = usePathname();
  const showCaseChrome = !isCaseDocumentDetailPath(pathname);

  return (
    <div className="flex h-full flex-col gap-4">
      {showCaseChrome ? (
        <>
          {caseHeader}
          {caseTabs}
        </>
      ) : null}

      <div className="min-h-0 flex-1">{children}</div>

      {modal}
    </div>
  );
}
