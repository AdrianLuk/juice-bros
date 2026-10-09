import { siteConfig } from "@/config/site";
import { captionLead, type InstagramPost } from "@/lib/instagram";
import { formatAiredShort } from "./format";
import { PlayMark } from "./play-mark";

/**
 * The Instagram rail. Disappears entirely when the feed returns nothing,
 * rather than printing empty frames.
 *
 * Shared by the home page and the contact page. The tiles are 9:16 because
 * almost everything the account posts is a Reel, and a square crop cut the
 * hosts out of their own videos. Six across from `lg`; below that the row
 * scrolls sideways and runs to the screen edge, so the cut-off card says
 * "there's more" without a control. Posts open on Instagram, not in a
 * lightbox: following the account is the point, and that happens there.
 *
 * The heading is a prop because the two pages say different things with it.
 */
export function InstagramStrip({
  posts,
  title,
  className = "bx-measure py-10 sm:py-14",
}: {
  posts: InstagramPost[];
  title: string;
  className?: string;
}) {
  if (posts.length === 0) return null;

  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="bx-h2 text-lg sm:text-xl">{title}</h2>
        <a
          href={siteConfig.links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="bx-quietlink"
        >
          @juicebrospickleball
        </a>
      </div>

      <ul className="bx-rail mt-4 lg:mt-6">
        {posts.map((post) => {
          const lead = captionLead(post.caption);
          const verb = post.type === "video" ? "Watch" : "View";
          return (
            <li key={post.id} className="flex flex-col">
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-tile aspect-[9/16]"
                aria-label={lead ? `${verb} on Instagram: ${lead}` : `${verb} on Instagram`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote Instagram CDN image, sized by the API */}
                <img
                  src={post.thumbnail}
                  alt=""
                  width={360}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
                {post.type === "video" && <PlayMark />}
              </a>
              {/* Hidden from assistive tech: the tile's label already reads it. */}
              {lead && (
                <p aria-hidden className="mt-3 line-clamp-2 text-[0.9375rem] leading-snug">
                  {lead}
                </p>
              )}
              <p className="bx-meta mt-auto pt-1.5">{formatAiredShort(post.timestamp)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
