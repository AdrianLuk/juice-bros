const GRAPH_VERSION = "v21.0";
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

export type InstagramPost = {
  id: string;
  caption: string;
  permalink: string;
  thumbnail: string;
  timestamp: string;
};

type RawMediaItem = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

/**
 * Latest posts from the Instagram Graph API (requires a Business/Creator account
 * linked to a Facebook Page, plus a long-lived access token). Cached for an hour
 * via ISR. Returns [] if env vars are missing or the API call fails, so pages
 * render fine without the feed.
 */
export async function getLatestInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  if (!IG_USER_ID || !ACCESS_TOKEN) return [];

  try {
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${IG_USER_ID}/media` +
      `?fields=${fields}&limit=${limit}&access_token=${ACCESS_TOKEN}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];

    const json = (await res.json()) as { data?: RawMediaItem[] };
    return (json.data ?? [])
      .filter((item) => item.media_type !== "VIDEO" || item.thumbnail_url)
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        caption: item.caption ?? "",
        permalink: item.permalink,
        thumbnail: item.media_type === "VIDEO" ? item.thumbnail_url! : item.media_url,
        timestamp: item.timestamp,
      }));
  } catch {
    return [];
  }
}
