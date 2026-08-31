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
 * for the app's actual destructive actions) while still standing apart from
 * `looking`'s plain dashed tint.
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
          ? "border-dashed border-accent-foreground/25 bg-accent/25"
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
        className="truncate text-base leading-none font-bold text-foreground/70"
      >
        {type === "looking" ? "Looking" : "Busy"}
      </span>
    </div>
  );
}
