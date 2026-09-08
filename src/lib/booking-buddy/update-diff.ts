/**
 * What applying a Reservation Update Notice would actually change about a
 * Booking already on file (issue #458), as rows a review card renders.
 *
 * A matched update used to need no such thing: it was matched on the slot, so
 * the only fields that could differ were format and court, and the card could
 * simply say "Updates a booking you logged." Once an update can be matched to
 * a Booking whose *time* it moves — and, on a suggested match, to a Booking
 * the User themselves picked — "what exactly is about to happen to it" stops
 * being obvious and has to be shown. This is that comparison, kept pure and
 * away from the card so it can be read as a table of cases instead of JSX.
 *
 * Only what changes is listed. An empty result means the email describes the
 * Booking exactly as it already stands, which is worth saying out loud rather
 * than rendering an empty panel.
 */

import { formatCourtLabel, formatTimeLabel } from "./bookings.ts";
import { BOOKING_FORMAT_LABEL, type BookingFormat } from "./capacity.ts";

export type UpdateDiffRow = {
  label: string;
  before: string;
  after: string;
};

type Reservation = {
  startTime: string;
  endTime: string;
  courtLabel: string | null;
  format: BookingFormat;
  players: readonly string[];
};

function timeRange(reservation: { startTime: string; endTime: string }): string {
  return `${formatTimeLabel(reservation.startTime)}–${formatTimeLabel(reservation.endTime)}`;
}

/**
 * The Booking as it stands versus the reservation the email describes.
 *
 * Players are compared as the written list, in the order each side gives
 * them: an update's own Player(s) section is what the facility says is on
 * that court now, and a re-ordering of the same names is not a change worth
 * a row. An update carrying *no* names changes nothing here, matching what
 * the write path does with it — an email with no Player(s) section is the
 * facility saying nothing, not "nobody".
 */
export function describeUpdateChanges(before: Reservation, after: Reservation): UpdateDiffRow[] {
  const rows: UpdateDiffRow[] = [];

  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    rows.push({ label: "Time", before: timeRange(before), after: timeRange(after) });
  }

  if (before.courtLabel !== after.courtLabel) {
    rows.push({
      label: "Court",
      before: formatCourtLabel(before.courtLabel),
      after: formatCourtLabel(after.courtLabel),
    });
  }

  if (before.format !== after.format) {
    rows.push({
      label: "Format",
      before: BOOKING_FORMAT_LABEL[before.format],
      after: BOOKING_FORMAT_LABEL[after.format],
    });
  }

  const beforePlayers = before.players.join(", ");
  const afterPlayers = after.players.join(", ");
  if (after.players.length > 0 && beforePlayers !== afterPlayers) {
    rows.push({
      label: "Players",
      before: beforePlayers || "Nobody logged",
      after: afterPlayers,
    });
  }

  return rows;
}
