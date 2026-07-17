const CHANNEL_ID = "UC_5WnU_sagF2tCBmioV9b3g";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export type YoutubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
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
      if (!id || !title || !published) continue;
      videos.push({
        id,
        title: decodeXmlEntities(title),
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        published,
      });
    }
    return limit ? videos.slice(0, limit) : videos;
  } catch {
    // Feed unreachable at build/revalidate time — render pages without the grid.
    return [];
  }
}
