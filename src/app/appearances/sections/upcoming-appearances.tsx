import type { Appearance } from "@/lib/appearances";
import { AppearanceRow } from "./appearance-row";

/**
 * The rest of the calendar, after the featured next one.
 *
 * Renders nothing at all when it is empty *and* something was featured above —
 * a heading over the words "nothing else on the calendar" is a section that
 * exists to apologise. When there is no featured entry either, the page still
 * needs to say so, which is what `standalone` is for.
 */
export function UpcomingAppearances({
  appearances,
  standalone = false,
}: {
  appearances: Appearance[];
  standalone?: boolean;
}) {
  if (appearances.length === 0 && !standalone) return null;

  return (
    <section className="py-14 sm:py-20">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">
        {standalone ? "Upcoming" : "Also on the calendar"}
      </h2>

      {appearances.length === 0 ? (
        <p className="bx-lead mt-5">
          Nothing on the calendar right now. We add tournaments here as we sign
          up, so check back.
        </p>
      ) : (
        <ul className="mt-7 flex flex-col gap-4">
          {appearances.map((appearance) => (
            <AppearanceRow key={appearance.name} appearance={appearance} />
          ))}
        </ul>
      )}
    </section>
  );
}
