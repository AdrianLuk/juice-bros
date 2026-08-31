import Link from "next/link";

import { formatAvailabilityWindowRange } from "@/lib/booking-buddy/availability";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "@/lib/booking-buddy/orgs";
import { AvailabilityWindowRow } from "@/components/booking-buddy/availability";
import { AVAILABILITY_PATH } from "@/lib/booking-buddy/routes";
import type { DashboardAvailabilityWindow } from "@/lib/booking-buddy/actions/dashboard";

/**
 * The "what have I blocked off" list next to the calendar — the undo path
 * ADR 0006 counts on ("an unwanted [window] can simply be deleted"), since the
 * calendar's own hatch/dashed overlay has nothing clickable to delete from.
 * Plain server-rendered list, same reasoning as `UpcomingBookingsSidebar`:
 * visible regardless of which calendar view is active.
 *
 * Same zone as `createAvailabilityWindow` writes with
 * (`DEFAULT_HAND_NAMED_TIME_ZONE`) — there is no per-window zone to read back.
 */
export function DashboardAvailabilitySidebar({
  windows,
  now,
}: {
  windows: DashboardAvailabilityWindow[];
  now: Date;
}) {
  const upcoming = windows
    .filter((window) => new Date(window.endsAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Your availability blocks
        </h2>
        <Link
          href={AVAILABILITY_PATH}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
        >
          See all
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
          Nothing blocked off. Use &ldquo;Block off time&rdquo; to let friends
          know when you&apos;re available.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((window) => (
            <AvailabilityWindowRow
              key={window.id}
              window={window}
              rangeLabel={formatAvailabilityWindowRange(window, DEFAULT_HAND_NAMED_TIME_ZONE)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
