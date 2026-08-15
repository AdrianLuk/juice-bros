/**
 * Pure input handling and display logic for Bookings.
 *
 * A Booking mirrors a reservation that already exists on the facility's own
 * platform (ADR 0002), so everything here is about keeping hand-entered data
 * coherent and rendering it back as the same wall-clock time the User read off
 * that platform.
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `bookings` migration — change one and you must change the other.
 */

export const COURT_LABEL_MAX_LENGTH = 40;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type NewBooking = {
  orgId: string;
  courtLabel: string;
  /**
   * A wall-clock time carrying its own zone — `2026-08-20 18:00:00
   * America/Toronto`. Postgres does the DST-aware conversion to an instant
   * itself, which is a great deal harder to get wrong than doing it here.
   */
  startsAt: string;
  endsAt: string;
  timeZone: string;
};

/**
 * Is this a zone anything can actually render?
 *
 * The trigger on `bookings` asks Postgres the same question and is the
 * authority. Asking here first is what turns a raw constraint violation into a
 * sentence about the form the User just filled in.
 */
export function isKnownTimeZone(zone: string): boolean {
  if (!zone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A calendar date, not merely four digits and two hyphens. */
function isRealDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  // Round-tripping is what catches 2026-13-01 and 2026-02-30, which the
  // pattern alone is happy with.
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
  );
}

export function parseNewBooking(
  formData: FormData,
): NewBooking | { error: string } {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Pick which place this booking is at." };
  }

  const courtLabel = String(formData.get("court_label") ?? "").trim();
  if (!courtLabel) {
    return { error: "Which court? Put in whatever the booking screen calls it." };
  }

  if (courtLabel.length > COURT_LABEL_MAX_LENGTH) {
    return {
      error: `That court name is too long — ${COURT_LABEL_MAX_LENGTH} characters at most.`,
    };
  }

  const date = String(formData.get("date") ?? "").trim();
  if (!isRealDate(date)) {
    return { error: "Pick a date for the booking." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return { error: "Pick a start and end time." };
  }

  // Zero-padded 24-hour times compare correctly as strings. A Booking that ran
  // past midnight would defeat this, and is not a thing a court reservation
  // does — the database refuses it too.
  if (endTime <= startTime) {
    return { error: "The end time has to be after the start time." };
  }

  const timeZone = String(formData.get("time_zone") ?? "").trim();
  // Never defaulted to the server's zone. That is precisely the bug this column
  // exists to prevent: in production the server is on UTC, which would turn a
  // 6pm court booking into 10pm.
  if (!isKnownTimeZone(timeZone)) {
    return { error: "Couldn't tell what time zone you're in. Try again." };
  }

  return {
    orgId,
    courtLabel,
    startsAt: `${date} ${startTime}:00 ${timeZone}`,
    endsAt: `${date} ${endTime}:00 ${timeZone}`,
    timeZone,
  };
}

/**
 * When a Booking is, written as the facility's own clock read it.
 *
 * `starts_at` is an instant, so rendering it needs to be told which clock to
 * use. Left to the server's own zone it reads four hours out in production, and
 * nobody notices until someone shows up late.
 */
export function formatBookingWhen(booking: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
}): string {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);

  // The trigger refuses a zone Postgres doesn't know, so a row that lands here
  // should not exist. Throwing anyway would take down the whole list to punish
  // one row, so UTC and an admission is the better answer.
  const usable = isKnownTimeZone(booking.timeZone);
  const zone = usable ? booking.timeZone : "UTC";

  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: zone,
  });

  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  });

  const when = `${day.format(start)} · ${clock.format(start)} – ${clock.format(end)}`;

  return usable ? when : `${when} (UTC)`;
}

/** Turns a failed Booking write into something worth reading. */
export function bookingWriteMessage(error: { code?: string }): string {
  switch (error.code) {
    case "23514":
      // Raised by assert_booking_coherent (someone else's Org, or a zone
      // Postgres doesn't know) and by the ends-after-starts constraint.
      return "That booking doesn't sit under one of your own places.";
    default:
      return "Couldn't save that booking. Try again.";
  }
}
