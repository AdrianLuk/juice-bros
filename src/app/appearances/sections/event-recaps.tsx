import type { EventRecap } from "@/content/event-recaps";
import { Picture } from "@/components/picture";

/**
 * Photos from an event the hosts went to, between the calendar and the
 * collapsed "Already played" list.
 *
 * It sits above that list on purpose. The past list is a disclosure that opens
 * closed, so anything under it is something a visitor has to ask for, and these
 * are the only photographs on the page below the header. They are not
 * tournaments (no brackets, no registration link), so they are not rows: the
 * heading names the event and one plain line says why it is on a page about
 * where to find the hosts.
 *
 * One tall photo beside a two-by-two of landscape ones. At `lg` the tall photo
 * stretches to the height the four landscape tiles make, so the block is a
 * single rectangle rather than a ragged edge; below `lg` it runs full width
 * first and the four follow in pairs. Each photo is a `.bx-tile`, the site's one
 * image gesture, and none of them link anywhere.
 */
export function EventRecaps({ recaps }: { recaps: EventRecap[] }) {
  if (recaps.length === 0) return null;

  return (
    <>
      {recaps.map((recap) => {
        const [lead, ...rest] = recap.photos;

        return (
          <section key={recap.name} className="bx-hair py-14 sm:py-20">
            <h2 className="bx-h2 max-w-[28ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
              {recap.name}
            </h2>
            <p className="bx-meta mt-3">
              {recap.date}
              <span aria-hidden> &middot; </span>
              {recap.location}
            </p>
            {recap.note && (
              <p className="mt-3.5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
                {recap.note}
              </p>
            )}

            <div className="mt-8 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
              <figure className="bx-tile aspect-4/5 lg:aspect-auto">
                <Picture
                  src={lead.src}
                  alt={lead.alt}
                  sizes="(min-width: 1216px) 23rem, (min-width: 1024px) 30vw, 100vw"
                  loading="lazy"
                  className={lead.position ?? "object-center"}
                />
              </figure>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {rest.map((photo) => (
                  <figure key={photo.src} className="bx-tile aspect-3/2">
                    <Picture
                      src={photo.src}
                      alt={photo.alt}
                      sizes="(min-width: 1216px) 23rem, (min-width: 1024px) 30vw, 50vw"
                      loading="lazy"
                      className={photo.position ?? "object-center"}
                    />
                  </figure>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
