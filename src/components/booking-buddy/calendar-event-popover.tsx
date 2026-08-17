"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * The "click a calendar event, see its details" popover mechanics, generic
 * over whatever the event represents — a Booking on the owner's own
 * dashboard (issue #23), a friend's busy time on the friend calendar (issue
 * #61). One implementation shared by the Week grid, Month cells, and the
 * Agenda list, same as before #61: only what renders inside the trigger and
 * the panel is caller-supplied now, not which kind of event it's for.
 *
 * `className`/`style` land on the trigger `<button>` itself, not on a div
 * inside it — the Week grid positions its chips with `position: absolute`,
 * and a positioned *descendant* of a plain static-flow button collapses the
 * button's own box to zero size (its only content was pulled out of flow),
 * which reads to the accessibility tree and to Playwright's `toBeVisible` as
 * a hidden, unclickable trigger even though the chip still paints in the
 * right place. The button has to be the positioned element.
 */
export function CalendarEventPopover<T>({
  event,
  className,
  style,
  children,
  renderDetails,
}: {
  event: T;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  renderDetails: (event: T) => ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" />}
        className={cn("text-left", className)}
        style={style}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {renderDetails(event)}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The three event-chip shells (Week/Month/Agenda), shared between the
 * owner's own dashboard and the friend calendar (issue #61) — both wrap
 * their own content around `CalendarEventPopover` with these exact classes,
 * so a chip's visual style (radius, padding, colour) lives in one place
 * rather than being kept in sync by hand across two otherwise-unrelated
 * files.
 */
export const WEEK_EVENT_CLASS =
  "absolute block overflow-hidden rounded-md bg-primary px-1.5 py-1 text-[11px] leading-tight text-primary-foreground shadow-sm ring-1 ring-black/5";

export const MONTH_EVENT_CLASS =
  "block w-full overflow-hidden rounded-sm bg-primary/90 px-1 py-0.5 text-[10px] font-medium text-primary-foreground";

export const AGENDA_EVENT_CLASS =
  "flex w-full items-center gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm hover:bg-muted";
