const CHANNEL_ID = "UC_5WnU_sagF2tCBmioV9b3g";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export type YoutubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  description: string;
  published: string;
};

function decodeXmlEntities(text: string) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

/**
 * Punchy one-liner from a video's full description: just the first paragraph,
 * collapsed to one line and capped so it reads like a hook, not a video description
 * (which usually runs into timestamps/hashtags after a couple lines).
 */
export function getEpisodeHook(description: string, maxLength = 140) {
  const firstParagraph = description.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (firstParagraph.length <= maxLength) return firstParagraph;
  return `${firstParagraph.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Latest videos from the channel's public RSS feed (max 15, no API key).
 * Cached for an hour via ISR.
 */
export async function getLatestVideos(limit?: number): Promise<YoutubeVideo[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const videos: YoutubeVideo[] = [];
    for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const id = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
      const description = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? "";
      if (!id || !title || !published) continue;
      videos.push({
        id,
        title: decodeXmlEntities(title),
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        description: decodeXmlEntities(description),
        published,
      });
    }
    return limit ? videos.slice(0, limit) : videos;
  } catch {
    // Feed unreachable at build/revalidate time - render pages without the grid.
    return [];
  }
}
