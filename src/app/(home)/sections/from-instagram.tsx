import type { InstagramPost } from "@/lib/instagram";
import { InstagramStrip } from "@/components/bx/instagram-strip";

/**
 * The home page's Instagram shelf. The strip itself is shared with the contact
 * page (`@/components/bx/instagram-strip`); this only fixes the heading, which
 * is what the two pages use it to say.
 */
export function FromInstagram({ posts }: { posts: InstagramPost[] }) {
  return <InstagramStrip posts={posts} title="Between episodes" />;
}
