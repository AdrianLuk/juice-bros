import Link from "next/link";

import { cn } from "@/lib/utils";
import { PRIVACY_PATH } from "@/lib/booking-buddy/routes";

/**
 * The quiet footer every signed-in Booking Buddy page ends on (ADR 0016).
 *
 * The old `FooterNav` carried hand-picked cross-links (Friends↔Groups,
 * Bookings↔Facilities, "Back to Booking Buddy") that only existed because the
 * flat nav didn't express those relationships — the two-tier nav does now, so
 * this is down to just Privacy and one way back out to the marketing site.
 */
export function BbFooter({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "mt-16 flex flex-wrap items-center gap-4 border-t border-[var(--bb-cork-edge)]/30 pt-4 font-bb-sign text-[0.68rem] tracking-widest uppercase",
        className,
      )}
      aria-label="Booking Buddy footer"
    >
      <Link
        href={PRIVACY_PATH}
        className="text-[var(--bb-on-cork-dim)] transition-colors hover:text-foreground"
      >
        Privacy
      </Link>
      <Link
        href="/"
        className="text-[var(--bb-on-cork-dim)] transition-colors hover:text-foreground"
      >
        Juice Bros Pickleball
      </Link>
    </nav>
  );
}
