import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { getEpisodeHook, getEpisodeShowNotes } from "@/lib/youtube";
import { episodeMetaTitle, getEpisodes, type Episode } from "@/lib/episodes";
import { buildEpisodeJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { EpisodePlayer } from "@/components/bx/episode-player";
import { EpisodeGrid } from "@/components/bx/episode-card";
import { SectionHead } from "@/components/bx/page-head";
import { formatAiredLong, formatRuntime, formatRuntimeWords } from "@/components/bx/format";

/** How many other episodes to offer at the foot of the page. */
const MORE_COUNT = 4;

/**
 * Direct slug match wins. Failing that, a request for a former slug (an
 * override's redirectFrom) redirects to the episode it now belongs to.
 * Neither match: 404. Shared by generateMetadata and the page below so the
 * two can't disagree on what a slug resolves to.
 */
async function resolveEpisode(slug: string): Promise<Episode> {
  const episodes = await getEpisodes();

  const episode = episodes.find((candidate) => candidate.slug === slug);
  if (episode) return episode;

  const redirectTarget = episodes.find((candidate) => candidate.redirectFrom.includes(slug));
  if (redirectTarget) redirect(`/podcast/${redirectTarget.slug}`);

  notFound();
}

export async function generateMetadata({
  params,
}: PageProps<"/podcast/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const episode = await resolveEpisode(slug);

  return pageMetadata({
    title: episodeMetaTitle(episode.title),
    description: getEpisodeHook(episode.description),
    path: `/podcast/${episode.slug}`,
    // maxresdefault (1280x720) rather than the 480x360 hqdefault used in
    // grids - social/video cards want a 16:9 image at OG's recommended size.
    image: {
      url: `https://i.ytimg.com/vi/${episode.id}/maxresdefault.jpg`,
      alt: episode.title,
      width: 1280,
      height: 720,
    },
    video: {
      url: `https://www.youtube.com/embed/${episode.id}`,
      width: 1280,
      height: 720,
    },
  });
}

/**
 * One episode.
 *
 * The change that matters here is that the episode now plays. The incumbent
 * page put a still thumbnail at the top and two buttons underneath it, so
 * every tile on the site promising "Play <episode>" delivered a picture of a
 * play button and a trip to another domain. It plays in place now, through the
 * same click-to-load embed the About page uses, which keeps YouTube's player JS
 * off the first paint until someone actually asks for it.
 *
 * The second change is that the page is no longer a dead end: it closes on four
 * more episodes rather than on a pair of outbound buttons, so finishing one is
 * an invitation to start another.
 */
export default async function EpisodePage({ params }: PageProps<"/podcast/[slug]">) {
  const { slug } = await params;
  const episode = await resolveEpisode(slug);

  const episodes = await getEpisodes();
  const more = episodes.filter((candidate) => candidate.id !== episode.id).slice(0, MORE_COUNT);

  const title = episodeMetaTitle(episode.title);
  const runtime = formatRuntime(episode.duration);
  const spokenRuntime = formatRuntimeWords(episode.duration);
  const showNotes = episode.description ? getEpisodeShowNotes(episode.description) : "";

  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildEpisodeJsonLd(episode)) }}
      />

      <article className="bx-measure pt-10 pb-16 sm:pt-14 sm:pb-20">
        <Link href="/podcast" className="bx-quietlink group inline-flex items-center">
          <span
            aria-hidden
            className="mr-1.5 inline-block transition-transform duration-200 group-hover:-translate-x-0.5"
          >
            &larr;
          </span>
          All episodes
        </Link>

        <div className="mt-6">
          <EpisodePlayer
            videoId={episode.id}
            title={title}
            poster={`https://i.ytimg.com/vi/${episode.id}/maxresdefault.jpg`}
            runtime={runtime}
            morphTarget
          />
        </div>

        {/* Title, then metadata under it - the order every other surface in
            this system uses. The clamp keeps the ladder's 36px h1 floor at
            390px and only lowers the ceiling, since an episode title is a
            sentence rather than a two-word page name. */}
        <h1 className="bx-display mt-9 max-w-[22ch] text-[clamp(2.25rem,4.6vw,2.875rem)]">
          {title}
        </h1>
        {/* The date alone. The runtime is already on the player's chip, in the
            place a video puts it, so printing "22 min" here as well spent the
            metadata line on a fact read two lines above - and in a second
            format. It stays for screen readers, which never reach the chip:
            the player is named by its `aria-label`. */}
        <p className="bx-meta mt-4">
          {formatAiredLong(episode.published)}
          {spokenRuntime && <span className="sr-only">, {spokenRuntime}</span>}
        </p>

        {showNotes && (
          <div className="mt-7 max-w-[62ch] text-[1.0625rem] leading-relaxed whitespace-pre-line">
            {showNotes}
          </div>
        )}

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href={episode.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-yt"
          >
            <YoutubeIcon className="size-[1.125rem]" />
            Watch on YouTube
          </a>
          <a
            href={siteConfig.links.spotify}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-sp"
          >
            <SpotifyIcon className="size-[1.125rem]" />
            Listen on Spotify
          </a>
        </div>
      </article>

      {more.length > 0 && (
        <section className="bx-measure bx-hair py-14 sm:py-20">
          <SectionHead
            title="More episodes"
            link={
              <Link href="/podcast" className="bx-quietlink">
                View all
              </Link>
            }
          />
          <div className="mt-7">
            <EpisodeGrid episodes={more} />
          </div>
        </section>
      )}
    </div>
  );
}
