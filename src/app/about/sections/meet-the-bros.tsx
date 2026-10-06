import Link from "next/link";

import { team } from "@/content/team";
import { InstagramIcon } from "@/components/icons";
import { Picture } from "@/components/picture";

/**
 * One portrait per host, from Creator Night at The Backyard Club. Keyed by
 * `team` name so the panel stays a plain map over the roster; a host with no
 * entry renders without a photo rather than failing. Both are tall camera
 * originals cropped to 4:3 at the top of the panel, so `position` is what keeps
 * the face and the paddle in frame.
 */
const portraits: Record<string, { src: string; alt: string; position: string }> = {
  Daven: {
    src: "/pictures/creator-night-daven-ready-position-portrait.jpg",
    alt: "Daven in a cap and Juice Bros shirt, stepping in with his paddle low and ready",
    position: "object-[50%_30%]",
  },
  Adrian: {
    src: "/pictures/creator-night-adrian-forehand-portrait.jpg",
    alt: "Adrian in glasses and a Juice Bros shirt, about to hit a forehand",
    position: "object-[50%_28%]",
  },
};

/**
 * Flush to the panel's top and side edges, so the photo reads as the head of
 * the panel rather than a picture sitting inside a card. The panel clips it to
 * its own radius.
 */
function HostPortrait({ name }: { name: string }) {
  const portrait = portraits[name];
  if (!portrait) return null;

  return (
    <div className="-mx-6 -mt-6 mb-6 aspect-4/3 overflow-hidden sm:-mx-7 sm:-mt-7">
      <Picture
        src={portrait.src}
        alt={portrait.alt}
        sizes="(min-width: 1216px) 36rem, (min-width: 640px) 50vw, 100vw"
        loading="lazy"
        className={`h-full w-full object-cover ${portrait.position}`}
      />
    </div>
  );
}

/**
 * The two hosts, with the on-court photograph at the size it deserves.
 *
 * The home page runs a different, smaller shot beside a two-line summary;
 * this is the page someone comes to when that summary wasn't enough, so the
 * photograph is full width and each host gets a panel of their own, headed by
 * their own portrait. The wide photo is a camera original at 2048px: the old
 * phone shots top out at 1600px and go soft stretched across the 72rem
 * measure.
 *
 * The `bio` strings in `content/team.ts` are interim by design - Adrian is
 * writing the real ones in each host's own words - so the layout doesn't
 * depend on their length, and the paddle-and-shot line beneath (which is real
 * copy) reads as its own fact rather than as the end of a paragraph.
 */
export function MeetTheBros() {
  return (
    <section className="bx-measure py-16 sm:py-24">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">Meet the Bros</h2>

      {/* `Picture` (#418) rather than a bare <img>: it renders the pre-encoded
          AVIF/WebP sources for this photo and takes its intrinsic dimensions
          from the manifest. Its `<picture>` carries `display: contents`, so the
          `<img>` is still `.bx-tile`'s direct child for `object-fit: cover`.
          `sizes` is this layout's own - the figure runs the full 72rem measure
          here, not the 48rem column the incumbent gave it. */}
      <figure className="bx-tile mt-8 aspect-video">
        <Picture
          src="/pictures/adrian-dav.jpg"
          alt="Daven and Adrian courtside, mid-match"
          sizes="(min-width: 1216px) 72rem, 100vw"
          loading="lazy"
          decoding="async"
          className="object-[50%_30%]"
        />
      </figure>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {team.map((member) => (
          <div key={member.name} className="bx-panel flex flex-col overflow-hidden p-6 sm:p-7">
            <HostPortrait name={member.name} />
            <h3 className="bx-h2 text-lg sm:text-xl">{member.name}</h3>
            <p className="bx-meta mt-2">{member.role}</p>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-(--bx-muted)">
              {member.bio}
            </p>
            <p className="mt-4 border-t border-(--bx-line-soft) pt-4 text-[0.9375rem] leading-relaxed">
              {member.funFact}
            </p>
            <a
              href={member.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-actionlink mt-5 gap-2"
            >
              <InstagramIcon className="size-4" />
              Follow {member.name}
            </a>
          </div>
        ))}
      </div>

      {/* The way on from "who are these two" to watching them play. A quiet
          link, because it leaves the section rather than acting inside it. */}
      <Link href="/photos" className="bx-quietlink group mt-8 inline-flex items-center">
        More photos
        <span aria-hidden className="bx-arrow">
          &rarr;
        </span>
      </Link>
    </section>
  );
}
