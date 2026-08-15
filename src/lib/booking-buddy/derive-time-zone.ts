import { find as findTimeZones } from "geo-tz";

import { isKnownTimeZone } from "./timezone.ts";

/**
 * Coordinates give a zone (issue #20) — no question asked for a Place-backed
 * Org. `geo-tz` is an offline lookup against timezone-boundary polygons, so
 * this never touches the network — and unlike `google-places-client.ts`,
 * there's no secret to keep server-side either. What it does need to stay
 * clear of is the browser bundle: `geo-tz` reads its data file via `fs`,
 * which doesn't resolve there. Not marked `server-only` (that package throws
 * unconditionally outside Next's `react-server` bundler condition, including
 * under plain `node --test` — it would make this file untestable, and the
 * logic below is exactly the kind of pure, offline computation this codebase
 * prefers to unit test directly). Import hygiene does the job instead: this
 * is only ever imported from `actions/places.ts`, a Server Action — never
 * from `timezone.ts`, which `orgs.ts`/`bookings.ts` (and, through them, the
 * client components `orgs.tsx`/`bookings.tsx`) import directly.
 *
 * `find` returns its candidates ordered most-likely-first and never returns
 * an empty list for an in-range lat/lng — open ocean resolves to an
 * `Etc/GMT±N` offset zone rather than nothing, since that's still a real
 * answer to "what clock is this". It throws for an out-of-range lat/lng,
 * which a real Place's coordinates shouldn't be but a corrupted cache row
 * could be — caught here rather than left to blow up Org creation over a
 * single bad row.
 *
 * `geo-tz` is listed in `next.config.ts`'s `serverExternalPackages`. It reads
 * its data file via `fs` and a `path.join(__dirname, ...)` relative to its own
 * package directory; Turbopack otherwise rewrites `__dirname` for anything it
 * bundles into a synthetic path, which broke that read with a silent `ENOENT`
 * — caught right here, so it read as "coordinates too exotic to place"
 * instead of the bundler bug it actually was. `serverExternalPackages` makes
 * Next `require()` it directly in the Node process instead of bundling it, so
 * `__dirname` is real.
 */
export function deriveTimeZoneFromCoordinates(lat: number, lng: number): string | null {
  let matches: string[];
  try {
    matches = findTimeZones(lat, lng);
  } catch {
    return null;
  }

  const zone = matches[0];
  return zone && isKnownTimeZone(zone) ? zone : null;
}
