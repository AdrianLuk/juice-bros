import type { Metadata } from "next";
import type { ReactNode } from "react";

import { loosePhotos, photoSets } from "@/content/photo-sets";
import { pageMetadata } from "@/lib/metadata";
import {
  buildGallery,
  type GalleryPhoto,
  type LoosePhotosView,
  type PhotoSetView,
} from "@/lib/photo-sets";
import { PageHead } from "@/components/bx/page-head";
import { PhotoLightbox } from "@/components/photo-lightbox";
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
  const gallery = buildGallery(photoSets, loosePhotos);

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHead
        title="The photo wall"
        meta={`${gallery.photos.length} photos`}
        lead="Whenever someone points a camera at us at an event, the good ones end up here. Newest first."
      />

      {/* One lightbox for the whole page, so it steps across every section. */}
      <PhotoLightbox photos={gallery.photos}>
        <div className="bx-measure pb-6">
          {gallery.sets.map((set, index) => (
            <PhotoSetSection key={set.address} set={set} first={index === 0} />
          ))}
          {gallery.loose && (
            <LoosePhotosSection loose={gallery.loose} first={gallery.sets.length === 0} />
          )}
        </div>
      </PhotoLightbox>
    </div>
  );
}

/**
 * One section of the gallery: a heading, whatever sits under it, then its
 * photos. The section's id is its address, so a link elsewhere can land on
 * it; `scroll-mt` keeps the heading clear of the sticky nav.
 */
function GallerySection({
  address,
  title,
  photos,
  first,
  children,
}: {
  address: string;
  title: string;
  photos: GalleryPhoto[];
  first: boolean;
  children?: ReactNode;
}) {
  const headingId = `${address}-title`;

  return (
    <section
      id={address}
      aria-labelledby={headingId}
      className="bx-hair scroll-mt-24 py-14 sm:py-20"
    >
      <h2
        id={headingId}
        className="bx-h2 max-w-[28ch] text-[clamp(1.375rem,3.2vw,1.875rem)]"
      >
        {title}
      </h2>
      {children}

      <PhotoRows photos={photos} eager={first} linked className="mt-8" />
    </section>
  );
}

/** A Photo Set: under its heading, a meta line with its date and venue, then
 *  one plain line. */
function PhotoSetSection({ set, first }: { set: PhotoSetView; first: boolean }) {
  return (
    <GallerySection address={set.address} title={set.title} photos={set.photos} first={first}>
      <p className="bx-meta mt-3">
        {set.dates}
        <span aria-hidden> &middot; </span>
        {set.venue}
      </p>
      <p className="mt-3.5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
        {set.note}
      </p>
    </GallerySection>
  );
}

/**
 * The Loose Photos: a plain heading and the photos, with no meta line or note,
 * because there is no date or venue to give and making one up would be a
 * guess. Rendered only when there are some (`gallery.loose` is null otherwise).
 * The heading gives the reason they have no set rather than calling them the
 * rest (see Loose Photo in CONTEXT.md).
 */
function LoosePhotosSection({ loose, first }: { loose: LoosePhotosView; first: boolean }) {
  return (
    <GallerySection
      address={loose.address}
      title="Days we can't put a date on"
      photos={loose.photos}
      first={first}
    />
  );
}
