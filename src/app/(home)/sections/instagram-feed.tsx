import { siteConfig } from "@/config/site";
import { InstagramGrid } from "@/components/instagram-grid";
import { SectionHeading } from "@/components/typography/section-heading";
import type { InstagramPost } from "@/lib/instagram";

export function InstagramFeed({ posts }: { posts: InstagramPost[] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Follow Along" title="On Instagram" />
        <a
          href={siteConfig.links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          View profile &rarr;
        </a>
      </div>
      <div className="mt-8">
        <InstagramGrid posts={posts} />
      </div>
    </section>
  );
}
