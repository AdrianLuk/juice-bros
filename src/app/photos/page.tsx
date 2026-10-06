import type { Metadata } from "next";

import { photoSets } from "@/content/photo-sets";
import { pageMetadata } from "@/lib/metadata";
import { buildGallery, type PhotoSetView } from "@/lib/photo-sets";
import { PageHead } from "@/components/bx/page-head";
import { PhotoRows } from "@/components/photo-rows";

export const metadata: Metadata = pageMetadata({
  title: "Photos",
  description:
    "Photos of Juice Bros hosts Adrian and Daven playing pickleball, sorted by event with the newest first.",
  path: "/photos",
});

/**
 * Every Photo the hosts have, in Broadcast Dark: one section per Photo Set,
 * newest first. See the Photo Set and Photo entries in CONTEXT.md.
 *
 * No header photo, unlike the other interior pages. The gallery is the
 * photos, and a picture beside the title would just be the first one twice.
 */
export default function PhotosPage() {
  const gallery = buildGallery(photoSets);

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHead
        title="The photo wall"
        meta={`${gallery.photos.length} photos`}
        lead="Whenever someone points a camera at us at an event, the good ones end up here. Newest first."
      />

      <div className="bx-measure pb-6">
        {gallery.sets.map((set, index) => (
          <PhotoSetSection key={set.address} set={set} first={index === 0} />
        ))}
      </div>
    </div>
  );
}

/**
 * One Photo Set: heading, a meta line with its date and venue, one plain line,
 * then its photos. The section's id is the set's address, so a link elsewhere
 * can land on it; `scroll-mt` keeps the heading clear of the sticky nav.
 */
function PhotoSetSection({ set, first }: { set: PhotoSetView; first: boolean }) {
  const headingId = `${set.address}-title`;

  return (
    <section
      id={set.address}
      aria-labelledby={headingId}
      className="bx-hair scroll-mt-24 py-14 sm:py-20"
    >
      <h2
        id={headingId}
        className="bx-h2 max-w-[28ch] text-[clamp(1.375rem,3.2vw,1.875rem)]"
      >
        {set.title}
      </h2>
      <p className="bx-meta mt-3">
        {set.dates}
        <span aria-hidden> &middot; </span>
        {set.venue}
      </p>
      <p className="mt-3.5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
        {set.note}
      </p>

      <PhotoRows photos={set.photos} eager={first} className="mt-8" />
    </section>
  );
}
