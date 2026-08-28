import { getInstagramToken } from "./instagram-token.ts";

const API_BASE = "https://graph.instagram.com";
const FETCH_TIMEOUT_MS = 8000;

/**
 * How many posts the "On Instagram" grid shows on the homepage and Contact page.
 * The grid layout adapts to any count, so this is the only knob to turn.
 */
export const INSTAGRAM_POST_COUNT = 6;

export type InstagramPost = {
  id: string;
  caption: string;
  permalink: string;
  thumbnail: string;
  timestamp: string;
  /** "video" covers Reels and feed videos — the grid badges these with a play glyph. */
  type: "image" | "video";
};

type RawMediaItem = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
};

type RawMediaResponse = { data?: RawMediaItem[] };

/**
 * Pure mapping from the Instagram media endpoint's JSON to InstagramPost[].
 * Skips (rather than throws on) an item with no usable thumbnail or permalink —
 * a VIDEO still processing has no `thumbnail_url` yet, and one malformed row
 * shouldn't take down the batch. Stops once `limit` posts are collected.
 */
export function parseInstagramMedia(json: RawMediaResponse, limit: number): InstagramPost[] {
  const posts: InstagramPost[] = [];
  for (const item of json.data ?? []) {
    if (posts.length === limit) break;
    const isVideo = item.media_type === "VIDEO";
    const thumbnail = isVideo ? item.thumbnail_url : item.media_url;
    if (!thumbnail || !item.permalink) continue;
    posts.push({
      id: item.id,
      caption: item.caption ?? "",
      permalink: item.permalink,
      thumbnail,
      timestamp: item.timestamp,
      type: isVideo ? "video" : "image",
    });
  }
  return posts;
}

/**
 * Latest posts from @juicebrospickleball via the Instagram API with Instagram
 * Login (`graph.instagram.com/me/media`). The token comes from Edge Config in
 * production, an env var locally (see instagram-token.ts). Cached for an hour
 * via ISR. Returns [] when there's no token or the call fails, so the homepage
 * and Contact page render fine without the feed — the section is hidden
 * entirely rather than showing a broken state.
 */
export async function getLatestInstagramPosts(
  limit = INSTAGRAM_POST_COUNT,
): Promise<InstagramPost[]> {
  const stored = await getInstagramToken();
  if (!stored) return [];

  try {
    const params = new URLSearchParams({
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
      // A few extra so items dropped in parsing (a video still processing)
      // don't shrink the grid below `limit`.
      limit: String(limit + 4),
      access_token: stored.token,
    });
    const res = await fetch(`${API_BASE}/me/media?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Logged rather than swallowed so an expired token shows up somewhere
      // instead of looking identical to "the account has no posts."
      console.error("instagram: media fetch failed", res.status, await safeText(res));
      return [];
    }
    return parseInstagramMedia((await res.json()) as RawMediaResponse, limit);
  } catch (error) {
    console.error("instagram: media fetch failed", error);
    return [];
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
