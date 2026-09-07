import type { Appearance } from "@/lib/appearances";
import { describePlayers, formatAppearanceDates } from "@/lib/appearances";
import { AppearanceArt } from "./appearance-art";
import { DivisionsList } from "./divisions-list";

/**
 * The next confirmed tournament, on the page's one band.
 *
 * A tournament list has a time axis a podcast archive does not: the next one
 * is the only entry a visitor can act on, and the one in four months is
 * reference. So unlike the Podcast catalogue - where promoting the newest card
 * inside a grid of peers would only have taken room from the other thirteen -
 * featuring here is driven by the content rather than by wanting a hero.
 *
 * Renders nothing when no upcoming date is confirmed, rather than promoting a
 * tentative entry to the top of the page as though it were locked in.
 */
export function UpNext({ appearance }: { appearance: Appearance }) {
  const divisions = appearance.divisions ?? [];

  return (
    <section className="bx-band">
      <div className="bx-measure py-14 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-14">
          <AppearanceArt image={appearance.image} className="aspect-[16/10] w-full" />

          <div>
            <h2 className="bx-h2 max-w-[24ch] text-[clamp(1.75rem,3.4vw,2.125rem)]">
              {appearance.name}
            </h2>
            <p className="bx-meta mt-3">
              Up next
              <span aria-hidden> &middot; </span>
              {formatAppearanceDates(appearance)}
            </p>
            <p className="mt-3.5 text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
              {appearance.location}
            </p>
            {/* Who is playing is only stated here when there are no brackets to
                state it more precisely. With divisions listed, this line named
                the same two people the five rows below it already name, one per
                row - six printings of "Adrian and Daven" inside one block. */}
            {divisions.length === 0 && (
              <p className="mt-1 text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
                Playing: {describePlayers(appearance.players)}
              </p>
            )}

            {divisions.length > 0 && (
              <div className="mt-8 max-w-2xl">
                <DivisionsList divisions={divisions} />
              </div>
            )}

            {appearance.url && (
              <a
                href={appearance.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-actionlink group mt-8"
              >
                Tournament details
                <span aria-hidden className="bx-arrow">
                  &rarr;
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
