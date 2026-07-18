import type { InstagramPost } from "@/lib/instagram";

export function InstagramGrid({ posts }: { posts: InstagramPost[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block aspect-square overflow-hidden rounded-xl border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN thumbnail (signed, expiring URL), no next/image optimization */}
          <img
            src={post.thumbnail}
            alt={post.caption}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
        </a>
      ))}
    </div>
  );
}
