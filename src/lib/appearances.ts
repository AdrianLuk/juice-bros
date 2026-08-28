import type { Appearance } from "../../content/appearances.ts";

export type {
  Appearance,
  AppearanceDivision,
  AppearancePlayers,
  AppearanceStatus,
} from "../../content/appearances.ts";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The day an appearance begins (single `date` or range `startDate`), `yyyy-mm-dd`. */
export function appearanceStartDate(appearance: Appearance): string {
  return appearance.startDate ?? appearance.date ?? "";
}

/** The day an appearance ends (range `endDate` or the single `date`), `yyyy-mm-dd`. */
export function appearanceEndDate(appearance: Appearance): string {
  return appearance.endDate ?? appearance.date ?? appearance.startDate ?? "";
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Split appearances into `upcoming` and `past` relative to `now`. An entry
 * only becomes past once its last day is behind us, so a tournament running
 * today still shows as upcoming. `upcoming` is sorted soonest-first, `past`
 * most-recent-first. ISO date strings sort correctly as plain strings.
 */
export function splitAppearances(
  list: readonly Appearance[],
  now: Date = new Date(),
): { upcoming: Appearance[]; past: Appearance[] } {
  const today = isoDay(now);
  const upcoming: Appearance[] = [];
  const past: Appearance[] = [];

  for (const appearance of list) {
    if (appearanceEndDate(appearance) >= today) upcoming.push(appearance);
    else past.push(appearance);
  }

  upcoming.sort((a, b) => appearanceStartDate(a).localeCompare(appearanceStartDate(b)));
  past.sort((a, b) => appearanceStartDate(b).localeCompare(appearanceStartDate(a)));

  return { upcoming, past };
}

/** The soonest confirmed upcoming appearance, or null. Used by the home-page
 *  teaser (#190), which ignores tentative entries. */
export function nextConfirmedAppearance(
  list: readonly Appearance[],
  now: Date = new Date(),
): Appearance | null {
  return splitAppearances(list, now).upcoming.find((a) => a.status === "confirmed") ?? null;
}

/**
 * Human date for a row: "Sep 26, 2026" for a single day, "Aug 28-29, 2026"
 * for a same-month range, "Sep 30 - Oct 4, 2026" across months.
 */
export function formatAppearanceDates(appearance: Appearance): string {
  const startIso = appearanceStartDate(appearance);
  const endIso = appearanceEndDate(appearance);
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);

  if (endIso === startIso) return `${MONTHS[sm - 1]} ${sd}, ${sy}`;
  if (sy === ey && sm === em) return `${MONTHS[sm - 1]} ${sd}-${ed}, ${ey}`;
  if (sy === ey) return `${MONTHS[sm - 1]} ${sd} - ${MONTHS[em - 1]} ${ed}, ${ey}`;
  return `${MONTHS[sm - 1]} ${sd}, ${sy} - ${MONTHS[em - 1]} ${ed}, ${ey}`;
}

/** Short day label from an ISO `yyyy-mm-dd`, e.g. "Aug 29". For division rows,
 *  where the year is already on the appearance's main date line. */
export function formatShortDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "Adrian and Daven" / "Adrian" / "Daven" for the "who's playing" line. */
export function describePlayers(players: Appearance["players"]): string {
  if (Array.isArray(players)) {
    if (players.length <= 1) return players[0] ?? "";
    return `${players.slice(0, -1).join(", ")} and ${players[players.length - 1]}`;
  }
  if (players === "both") return "Adrian and Daven";
  return players === "adrian" ? "Adrian" : "Daven";
}

/** A schema.org `Event` node for one appearance: `startDate` always, `endDate`
 *  only for a real multi-day range, `location` as a `Place`, `url` when set. */
export function buildAppearanceEvent(appearance: Appearance) {
  const startDate = appearanceStartDate(appearance);
  const endDate = appearanceEndDate(appearance);

  return {
    "@type": "Event" as const,
    name: appearance.name,
    startDate,
    ...(endDate !== startDate ? { endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place" as const,
      name: appearance.location,
      address: appearance.location,
    },
    ...(appearance.url ? { url: appearance.url } : {}),
  };
}

/**
 * `Event` nodes for confirmed upcoming appearances only, soonest-first.
 * Tentative and past appearances are left out on purpose - Google penalizes
 * speculative or stale event markup.
 */
export function confirmedUpcomingEvents(
  list: readonly Appearance[],
  now: Date = new Date(),
): ReturnType<typeof buildAppearanceEvent>[] {
  return splitAppearances(list, now)
    .upcoming.filter((appearance) => appearance.status === "confirmed")
    .map(buildAppearanceEvent);
}
