import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A torn strip of masking tape carrying a label — a venue name on a game card,
 * a section header, a facility tag. The screen-printed notice voice (Anton),
 * uppercase, slightly askew.
 */
export function TapeLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("bb-tape text-[0.7rem] leading-none", className)}>
      {children}
    </span>
  );
}
