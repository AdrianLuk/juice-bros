import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Booking Buddy's rec-hall-board world (direction seed 861cf732). The cork
 * ground every signed-in surface stands on, plus the taped-off regions that
 * keep it *kept* — tight alignment under the cards' rotations.
 *
 * `Board` is the ground; `BoardRegion` is a ruled-off area with a masking-tape
 * label riding its top-left corner. The one orchestrated pin-in sequence is the
 * dashboard's alone and is armed by `BoardLoadOnce` (`board-load-once.tsx`) for
 * the first render of the session only — every other surface, and every return
 * to the dashboard, cuts to rest.
 */

export function Board({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("bb-board", className)}>{children}</div>;
}

export function BoardRegion({
  label,
  children,
  className,
  contentClassName,
  action,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Optional right-aligned control on the label rail (a "sheet view" toggle, a filter). */
  action?: ReactNode;
}) {
  return (
    <section
      className={cn("bb-region px-3 pt-6 pb-4 sm:px-4 sm:pt-7", className)}
    >
      <div className="pointer-events-none absolute -top-3.5 right-3 left-4 flex items-start justify-between">
        <span className="bb-tape pointer-events-auto text-xs leading-none">
          {label}
        </span>
        {action ? (
          <span className="pointer-events-auto -mt-1">{action}</span>
        ) : null}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-start gap-5 sm:gap-6",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
