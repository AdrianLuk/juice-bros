import type { SVGProps } from "react";

import type { InstagramPost } from "@/lib/instagram";

export function InstagramGrid({ posts }: { posts: InstagramPost[] }) {
  return (
    <div className="ig-strip grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={
            post.caption
              ? `Open this Instagram post on instagram.com: ${firstLine(post.caption)}`
              : "Open this Instagram post on instagram.com"
          }
          className="ig-tile group relative block aspect-square rounded-3xl bg-black/3 p-1.5 shadow-brand-sm ring-1 ring-black/5 transition-[transform,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
        >
          <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN thumbnail (signed, expiring URL), no next/image optimization */}
            <img
              src={post.thumbnail}
              alt={post.caption ? truncate(post.caption, 140) : "Instagram post from Juice Bros Pickleball"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-600 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.06] motion-reduce:group-hover:scale-100"
            />

            {post.type === "video" && (
              <span className="absolute left-2.5 top-2.5 flex size-7 items-center justify-center rounded-full bg-brand-black/50 text-white backdrop-blur-sm">
                <PlayGlyph className="size-3.5 translate-x-px" />
              </span>
            )}

            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-brand-black/95 via-brand-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <span className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full bg-brand-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
              <ArrowUpRightGlyph className="size-3.5" />
            </span>

            {post.caption && (
              <p className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 translate-y-1 p-3 text-[11px] font-medium leading-snug text-white opacity-0 transition-all duration-300 [text-shadow:0_1px_3px_rgb(0_0_0/0.55)] group-hover:translate-y-0 group-hover:opacity-100">
                {post.caption}
              </p>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

/** First non-empty line of a caption, for a concise accessible label. */
function firstLine(caption: string): string {
  const line = caption.split("\n").find((l) => l.trim().length > 0) ?? caption;
  return truncate(line.trim(), 100);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function PlayGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.79-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function ArrowUpRightGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
