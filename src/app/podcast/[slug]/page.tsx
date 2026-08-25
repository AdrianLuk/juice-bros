import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { getEpisodeHook } from "@/lib/youtube";
import { getEpisodes, type Episode } from "@/lib/episodes";
import { WatchListenButtons } from "@/components/watch-listen-buttons";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

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
    title: episode.title,
    description: getEpisodeHook(episode.description),
    path: `/podcast/${episode.slug}`,
  });
}

export default async function EpisodePage({ params }: PageProps<"/podcast/[slug]">) {
  const { slug } = await params;
  const episode = await resolveEpisode(slug);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-20 sm:px-6 lg:px-8">
      <Link
        href="/podcast"
        className="w-fit text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        &larr; All episodes
      </Link>

      <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-black/3 p-1.5 ring-1 ring-black/5">
        <div className="aspect-video overflow-hidden rounded-[1.25rem]">
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, no next/image optimization needed */}
          <img
            src={episode.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            {dateFormatter.format(new Date(episode.published))}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-[-0.02em] text-balance sm:text-4xl">
            {episode.title}
          </h1>
        </div>

        {episode.description && (
          <p className="max-w-2xl text-lg whitespace-pre-line text-muted-foreground">
            {episode.description}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <WatchListenButtons youtubeUrl={episode.url} />
        </div>
      </div>
    </div>
  );
}
