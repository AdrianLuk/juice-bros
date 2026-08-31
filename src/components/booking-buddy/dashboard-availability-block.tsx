import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { AvailabilityType } from "@/lib/booking-buddy/availability";

/**
 * One resolved Availability stretch (issue #23) — deliberately never a solid
 * fill the way a Booking block is, on either axis (color and pattern), so
 * the two are never confusable at a glance: a Booking is a real reservation,
 * this is only the User's own informational read of their schedule.
 *
 * `busy` gets a diagonal hatch rather than a saturated color — the same
 * device Google Calendar uses for a declared-busy stretch — which keeps
 * "busy" from reading as an error/destructive state (that color is reserved
 * for the app's actual destructive actions).
 *
 * `looking` ("looking to play") gets the opposite read: a warm primary-tinted
 * dashed block. Still dashed and still translucent, so it never reads as a
 * real Booking (those are solid brand orange, white text) — the dashed border
 * and low-opacity fill keep it informational — but the primary hue marks it as
 * an opening rather than the neutral grey a bare "not busy" stretch would get.
 */
export function DashboardAvailabilityBlock({
  type,
  className,
  style,
  label,
}: {
  type: AvailabilityType;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <div
      title={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "pointer-events-none flex items-center justify-center overflow-hidden rounded-sm border px-1 py-0.5",
        type === "looking"
          ? "border-dashed border-primary/45 bg-primary/10"
          : "border-border bg-muted",
        className,
      )}
      style={
        type === "busy"
          ? {
              ...style,
              backgroundImage:
                "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted-foreground) 22%, transparent) 0, color-mix(in oklch, var(--muted-foreground) 22%, transparent) 1px, transparent 1px, transparent 7px)",
            }
          : style
      }
    >
      <span
        aria-hidden="true"
        className={cn(
          "truncate text-base leading-none font-bold",
          type === "looking" ? "text-primary" : "text-foreground/70",
        )}
      >
        {type === "looking" ? "Looking" : "Busy"}
      </span>
    </div>
  );
}
