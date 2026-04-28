import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { RiLoaderLine } from "@remixicon/react";

function Spinner({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RiLoaderLine>) {
  return (
    <RiLoaderLine
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
