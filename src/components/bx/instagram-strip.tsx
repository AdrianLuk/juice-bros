import { siteConfig } from "@/config/site";
import type { InstagramPost } from "@/lib/instagram";

/**
 * The Instagram strip. Disappears entirely when the feed returns nothing,
 * rather than printing empty frames.
 *
 * Shared by the home page and the contact page: the same six squares, the same
 * tile gesture, and the same link out to the account. The heading is a prop
 * because the two pages are saying different things with it - "here's what
 * we're up to between episodes" on one, "here's the account you'd be messaging"
 * on the other.
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

      <ul className="mt-6 grid grid-cols-3 gap-3 lg:grid-cols-6">
        {posts.map((post) => (
          <li key={post.id}>
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-tile block aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Instagram CDN image, sized by the API */}
              <img
                src={post.thumbnail}
                alt={post.caption || "Instagram post from Juice Bros Pickleball"}
                width={320}
                height={320}
                loading="lazy"
                decoding="async"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
