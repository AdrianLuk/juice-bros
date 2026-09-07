import fallbackVideos from "../../content/videos-fallback.json" with { type: "json" };

const CHANNEL_ID = "UC_5WnU_sagF2tCBmioV9b3g";
// Every channel's "uploads" playlist ID is its channel ID with the UC prefix
// swapped for UU - avoids a channels.list call just to look it up.
const UPLOADS_PLAYLIST_ID = `UU${CHANNEL_ID.slice(2)}`;
const API_BASE = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;
const FETCH_TIMEOUT_MS = 8000;

// Width (in the API's valid 72-8192 range) requested when asking videos.list
// for embedHeight (see fetchVideoDetails). Only the resulting aspect ratio
// matters for deriveOrientation, not this literal pixel value.
const ORIENTATION_REFERENCE_WIDTH = 8192;

export type VideoOrientation = "landscape" | "portrait";

export type YoutubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  description: string;
  published: string;
  /** ISO 8601 (e.g. "PT23M15S"), straight from contentDetails.duration. */
  duration: string;
  orientation: VideoOrientation;
};

type PlaylistItem = {
  id: string;
  title: string;
  description: string;
  published: string;
};

type VideoDetail = {
  duration: string;
  embedHeight: number;
};

type RawPlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      title: string;
      description: string;
      publishedAt: string;
      resourceId?: { videoId?: string };
    };
  }>;
};

type RawVideosResponse = {
  items?: Array<{
    id: string;
    contentDetails?: { duration?: string };
    player?: { embedHeight?: number };
  }>;
};

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

// A YouTube description ends in furniture written for YouTube: a wall of
// hashtags, "Like, comment and subscribe", a prompt pointing at a comment box,
// a row of social links. On the channel page that is unremarkable. On the
// episode page it is the main reading matter, and it asks the reader to do
// things this page cannot do.
const HASHTAG_LINE = /^\s*(?:#[\p{L}\p{N}_]+[\s,]*)+$/u;
const URL_LINE = /^\s*(?:https?:\/\/\S+\s*)+$/i;
const CTA_LINE =
  /\b(?:like,?\s*(?:comment|share|and subscribe)|subscribe (?:to|for|here)|hit (?:the|that) (?:bell|like)|smash that|(?:drop|leave|share) (?:a|your|it)\b[^.]{0,40}\b(?:comments?|below)|comment below|let us know in the comments|link in (?:the )?(?:bio|description)|follow (?:us|along) on|check us out on|watch (?:the )?full episode)\b/i;

/**
 * An episode's description as show notes: the writing about the episode, with
 * YouTube's own furniture removed.
 *
 * Conservative on purpose. It drops whole lines that are nothing but hashtags,
 * nothing but links, or a recognisable call to action, and then tidies the
 * blank lines that leaves behind. It never edits inside a line and never
 * touches a paragraph of prose, so a description that is all real writing comes
 * back untouched.
 */
export function getEpisodeShowNotes(description: string): string {
  const kept = description
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return true;
      return !HASHTAG_LINE.test(trimmed) && !URL_LINE.test(trimmed) && !CTA_LINE.test(trimmed);
    })
    .join("\n");

  return kept.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * A video's aspect ratio, expressed as the orientation Short/Episode
 * classification cares about. `embedHeight` is what videos.list's `player`
 * part returns for a requested `referenceWidth` - neither API exposes native
 * pixel dimensions directly, but the ratio between the two is enough.
 */
export function deriveOrientation(embedHeight: number, referenceWidth: number): VideoOrientation {
  return embedHeight > referenceWidth ? "portrait" : "landscape";
}

/**
 * Pure mapping from playlistItems.list's JSON shape to our PlaylistItem[].
 * Skips (rather than throws on) an item with no snippet or no resourceId -
 * one malformed entry from the API shouldn't take down the whole batch.
 */
export function parsePlaylistItems(json: RawPlaylistItemsResponse): PlaylistItem[] {
  const items: PlaylistItem[] = [];
  for (const item of json.items ?? []) {
    const snippet = item.snippet;
    const id = snippet?.resourceId?.videoId;
    if (!snippet || !id) continue;
    items.push({
      id,
      title: snippet.title,
      description: snippet.description,
      published: snippet.publishedAt,
    });
  }
  return items;
}

/**
 * Pure mapping from videos.list's JSON shape to a lookup by video ID. Skips
 * an item missing duration or embedHeight rather than defaulting either -
 * a missing embedHeight silently defaulting to 0 would misclassify as
 * "landscape" (0 is never > any positive reference width), the opposite of
 * safe for a field whose whole purpose is spotting vertical Shorts.
 */
export function parseVideoDetails(json: RawVideosResponse): Map<string, VideoDetail> {
  const details = new Map<string, VideoDetail>();
  for (const item of json.items ?? []) {
    const duration = item.contentDetails?.duration;
    const embedHeight = item.player?.embedHeight;
    if (duration === undefined || embedHeight === undefined) continue;
    details.set(item.id, { duration, embedHeight });
  }
  return details;
}

/**
 * Latest videos from the channel's uploads, via the YouTube Data API
 * (playlistItems.list + videos.list). Cached for an hour via ISR. Falls back
 * to a committed snapshot (content/videos-fallback.json, refreshed via
 * scripts/snapshot-videos.mts) if the API key is missing, the live call
 * fails, or it's unreachable.
 */
export async function getLatestVideos(limit?: number): Promise<YoutubeVideo[]> {
  const videos = await fetchLiveVideos();
  const result = videos.length > 0 ? videos : (fallbackVideos as YoutubeVideo[]);
  return limit ? result.slice(0, limit) : result;
}

async function fetchLiveVideos(): Promise<YoutubeVideo[]> {
  const apiKey = API_KEY;
  if (!apiKey) return [];

  try {
    const items = await fetchPlaylistItems(apiKey);
    if (items.length === 0) return [];

    const details = await fetchVideoDetails(
      items.map((item) => item.id),
      apiKey,
    );

    const videos: YoutubeVideo[] = [];
    for (const item of items) {
      const detail = details.get(item.id);
      if (!detail) continue;
      videos.push({
        id: item.id,
        title: item.title,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        description: item.description,
        published: item.published,
        duration: detail.duration,
        orientation: deriveOrientation(detail.embedHeight, ORIENTATION_REFERENCE_WIDTH),
      });
    }
    return videos;
  } catch (error) {
    // API unreachable, timed out, or returned a bad response - caller falls
    // back to the snapshot. Logged (rather than swallowed) so an invalid key
    // or exhausted quota shows up somewhere instead of looking identical to
    // "the channel has no videos."
    console.error("youtube: live video fetch failed", error);
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

async function fetchJson(url: string, label: string): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error(`youtube: ${label} failed`, res.status, await safeText(res));
    throw new Error(`${label} failed with status ${res.status}`);
  }
  return res.json();
}

async function fetchPlaylistItems(apiKey: string): Promise<PlaylistItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    maxResults: "15",
    playlistId: UPLOADS_PLAYLIST_ID,
    key: apiKey,
  });
  const json = await fetchJson(`${API_BASE}/playlistItems?${params}`, "playlistItems.list");
  return parsePlaylistItems(json as RawPlaylistItemsResponse);
}

async function fetchVideoDetails(ids: string[], apiKey: string): Promise<Map<string, VideoDetail>> {
  const params = new URLSearchParams({
    part: "contentDetails,player",
    maxWidth: String(ORIENTATION_REFERENCE_WIDTH),
    id: ids.join(","),
    key: apiKey,
  });
  const json = await fetchJson(`${API_BASE}/videos?${params}`, "videos.list");
  return parseVideoDetails(json as RawVideosResponse);
}
