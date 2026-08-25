import { episodeOverrides, type EpisodeOverride } from "../../content/episode-overrides.ts";
import { getLatestVideos, type VideoOrientation, type YoutubeVideo } from "./youtube.ts";

// Short/Episode rule (see CONTEXT.md and docs/adr/0001-youtube-data-api-for-shorts-detection.md):
// a video is a Short when it's vertical (9:16) AND its duration is <=3 minutes.
const SHORT_MAX_DURATION_SECONDS = 3 * 60;

export type Episode = {
  id: string;
  /** Computed live as slugify(title) on every call - never persisted. */
  slug: string;
  title: string;
  url: string;
  thumbnail: string;
  /** The override's showNotes when present, otherwise the raw YouTube description. */
  description: string;
  published: string;
  duration: string;
  orientation: VideoOrientation;
  /** Former slugs that should redirect to this episode's current slug. */
  redirectFrom: string[];
};

/**
 * URL-safe slug from an episode title: lowercased, non-alphanumeric runs
 * collapsed to single hyphens, leading/trailing hyphens trimmed.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Total seconds in a YouTube contentDetails.duration string (ISO 8601,
 * e.g. "PT23M15S"). Missing components default to 0; a string with no
 * matching component at all (malformed) also resolves to 0.
 */
export function parseIsoDurationSeconds(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}

/**
 * A video is a Short when it's vertical and 3 minutes or under. Everything
 * else - including a vertical video over 3 minutes, or a <=3-minute
 * landscape video - is an Episode.
 */
export function isShort(video: Pick<YoutubeVideo, "duration" | "orientation">): boolean {
  return video.orientation === "portrait" && parseIsoDurationSeconds(video.duration) <= SHORT_MAX_DURATION_SECONDS;
}

/**
 * The feature's single testing seam: classifies one normalized video record
 * as a Short (null) or builds it into a fully-resolved Episode, applying its
 * matching entry from episode-overrides.ts (matched by videoId) if any.
 */
export function buildEpisode(video: YoutubeVideo, overrides: EpisodeOverride[]): Episode | null {
  if (isShort(video)) return null;

  const override = overrides.find((entry) => entry.videoId === video.id);

  return {
    id: video.id,
    // Fall back to the video ID on a title with no ASCII alphanumeric
    // characters (e.g. emoji-only) - an empty slug would break /podcast/[slug]
    // routing and could collide with another empty-titled episode.
    slug: slugify(video.title) || video.id,
    title: video.title,
    url: video.url,
    thumbnail: video.thumbnail,
    description: override?.showNotes ?? video.description,
    published: video.published,
    duration: video.duration,
    orientation: video.orientation,
    redirectFrom: override?.redirectFrom ?? [],
  };
}

/**
 * Every current Episode (Shorts excluded), built live from the latest videos
 * plus content/episode-overrides.ts. The one async entry point the
 * /podcast/[slug] route and its metadata both call.
 */
export async function getEpisodes(): Promise<Episode[]> {
  const videos = await getLatestVideos();
  return videos
    .map((video) => buildEpisode(video, episodeOverrides))
    .filter((episode): episode is Episode => episode !== null);
}
