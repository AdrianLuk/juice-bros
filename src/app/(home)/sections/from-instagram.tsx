import { siteConfig } from "@/config/site";
import type { InstagramPost } from "@/lib/instagram";

/**
 * The Instagram strip. Disappears entirely when the feed returns nothing,
 * rather than printing empty frames.
 */
export function FromInstagram({ posts }: { posts: InstagramPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="bx-measure bx-hair py-14 sm:py-20">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="bx-h2 text-[1.375rem] sm:text-2xl">Between episodes</h2>
        <a
          href={siteConfig.links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
        >
          @juicebrospickleball
        </a>
      </div>

      <ul className="mt-7 grid grid-cols-3 gap-3 lg:grid-cols-6">
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
