import { Picture } from "@/components/picture";

/**
 * How to find them at a venue, under the calendar.
 *
 * This is the photo that used to open the page: both of them from behind
 * mid-rally, DAVEN and ADRIAN across their backs. The header now carries a
 * sharper shot from Creator Night, but only one name is readable in it, and
 * this one is the literal answer to "how do I pick them out of a crowded
 * venue", so it moved here instead of being retired. It sits right after the
 * list of places they will actually be.
 *
 * Photo left and text right at `lg`, the same 30rem photo column the page
 * header uses, so the two photographs line up down the page.
 */
export function SpotUs() {
  return (
    <section className="bx-hair py-14 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,30rem)_1fr] lg:items-center lg:gap-16">
        <figure className="bx-tile aspect-4/3">
          <Picture
            src="/pictures/adrian-dav-backs-rally.jpg"
            alt="Daven and Adrian from behind mid-rally, their names on the backs of their Juice Bros shirts"
            sizes="(min-width: 1024px) 30rem, 100vw"
            loading="lazy"
            className="object-center"
          />
        </figure>

        <div>
          <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            Look for the names on our backs
          </h2>
          <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
            Our shirts have our names across the back, so we&apos;re easy to
            pick out from the rail.
          </p>
        </div>
      </div>
    </section>
  );
}
