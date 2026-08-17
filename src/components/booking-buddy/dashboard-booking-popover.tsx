"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DeleteBookingButton } from "@/components/booking-buddy/bookings";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import { formatInstantDateAndTime } from "@/lib/booking-buddy/datetime";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";

/**
 * The "click a Booking, see its details" popover (issue #23) — one instance
 * per rendered block, shared by the Week grid, Month cells, and the Agenda
 * list rather than three separate implementations.
 *
 * `className`/`style` land on the trigger `<button>` itself, not on a div
 * inside it — the Week grid positions its blocks with `position: absolute`,
 * and a positioned *descendant* of a plain static-flow button collapses the
 * button's own box to zero size (its only content was pulled out of flow),
 * which reads to the accessibility tree and to Playwright's `toBeVisible` as
 * a hidden, unclickable trigger even though the block still paints in the
 * right place. The button has to be the positioned element.
 */
export function DashboardBookingPopover({
  booking,
  className,
  style,
  children,
}: {
  booking: Booking;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { date, time } = formatInstantDateAndTime(booking);

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
        <div className="flex flex-col gap-2">
          <p className="font-heading text-sm font-semibold">{booking.orgName}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt>Date</dt>
            <dd className="text-foreground">{date}</dd>
            <dt>Time</dt>
            <dd className="text-foreground">{time}</dd>
            <dt>Court</dt>
            <dd className="text-foreground">{booking.courtLabel}</dd>
            <dt>Format</dt>
            <dd className="text-foreground">{BOOKING_FORMAT_LABEL[booking.format]}</dd>
          </dl>
        </div>
        <div className="mt-1 flex justify-end border-t border-border pt-2.5">
          <DeleteBookingButton booking={booking} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
