import Link from "next/link";

import { siteConfig } from "@/config/site";
import { episodes } from "@/data/episodes";
import { getYoutubeEmbedUrl } from "@/lib/utils";
import { getLatestVideos } from "@/lib/youtube";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "@/components/newsletter-form";
import { VideoGrid } from "@/components/video-grid";
import { YoutubeIcon, SpotifyIcon, InstagramIcon } from "@/components/icons";

const socialLinks = [
  {
    name: "YouTube",
    href: siteConfig.links.youtube,
    icon: YoutubeIcon,
    hoverClass: "hover:text-[#ff0000]",
  },
  {
    name: "Spotify",
    href: siteConfig.links.spotify,
    icon: SpotifyIcon,
    hoverClass: "hover:text-[#1db954]",
  },
  {
    name: "Instagram",
    href: siteConfig.links.instagram,
    icon: InstagramIcon,
    hoverClass: "hover:text-[#e1306c]",
  },
];

const listenLinks = [
  {
    name: "YouTube",
    href: siteConfig.links.youtube,
    icon: YoutubeIcon,
    cardClass: "bg-[#ff0000] hover:bg-[#d90000]",
  },
  {
    name: "Spotify",
    href: siteConfig.links.spotify,
    icon: SpotifyIcon,
    cardClass: "bg-[#1db954] hover:bg-[#1aa64c]",
  },
];

export default async function Home() {
  const featuredEpisode =
    episodes.find((episode) => episode.featured) ?? episodes[0];
  const latestVideos = await getLatestVideos(6);

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-brand-black text-white md:block md:min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
        <img
          src="/brand/JB_Banner_1920.jpeg"
          alt="Juice Bros Pickleball hosts"
          width={1600}
          height={901}
          className="w-full object-cover object-center md:max-h-[calc(100vh-4rem)] md:min-h-160"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--brand-black),transparent_15%)_0%,color-mix(in_oklch,var(--brand-black),transparent_55%)_100%)] md:block"
        />
        <div className="flex flex-1 items-center justify-center md:absolute md:inset-0 md:flex-none">
          <div className="flex w-full flex-col items-center gap-5 px-4 py-12 text-center sm:px-6 md:py-10 md:drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] lg:px-8">
            <p className="text-sm font-semibold tracking-[0.2em] text-brand-yellow uppercase">
              For Everyday Pickleball Players
            </p>
            <h1 className="max-w-2xl font-heading text-4xl font-black tracking-tight text-balance sm:text-6xl">
              Juice Bros Pickleball
            </h1>
            <p className="max-w-xl text-lg text-white/90 text-balance">
              {siteConfig.description}
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                nativeButton={false}
                className="h-11 px-6 text-base"
                render={<a href={siteConfig.links.youtube} target="_blank" rel="noopener noreferrer" />}
              >
                <YoutubeIcon className="size-5" />
                Watch Latest Episode
              </Button>
              <Button
                size="lg"
                nativeButton={false}
                className="h-11 bg-[#1db954] px-6 text-base text-white hover:bg-[#1db954]/90"
                render={<a href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer" />}
              >
                <SpotifyIcon className="size-5" />
                Listen on Spotify
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-5">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className={`text-white/85 transition-colors ${social.hoverClass}`}
                >
                  <social.icon className="size-6" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Latest episode */}
      {featuredEpisode && (
        <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
                Latest Episode
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                {featuredEpisode.title}
              </h2>
            </div>
            <Link
              href="/podcast"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See all episodes &rarr;
            </Link>
          </div>

          <div className="mt-6 grid gap-8 sm:grid-cols-5">
            <div className="overflow-hidden rounded-2xl border sm:col-span-3">
              <div className="aspect-video">
                <iframe
                  className="h-full w-full"
                  src={getYoutubeEmbedUrl(featuredEpisode.youtubeUrl)}
                  title={featuredEpisode.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 sm:col-span-2">
              <p className="text-muted-foreground">{featuredEpisode.description}</p>
              {featuredEpisode.spotifyUrl && (
                <Link
                  href={featuredEpisode.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-[#1db954]"
                >
                  <SpotifyIcon className="size-4" />
                  Listen on Spotify
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Latest videos */}
      {latestVideos.length > 0 && (
        <section className="w-full border-t px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
                Freshly Squeezed
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Latest Videos
              </h2>
            </div>
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View channel &rarr;
            </a>
          </div>
          <div className="mt-6">
            <VideoGrid videos={latestVideos} />
          </div>
        </section>
      )}

      {/* Listen everywhere */}
      <section className="border-y bg-muted/40">
        <div className="w-full px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-2xl font-bold tracking-tight">
            Listen everywhere
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {listenLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${social.cardClass}`}
              >
                <social.icon className="size-4" />
                {social.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-brand-black text-white">
        <div className="flex w-full flex-col items-center gap-4 px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Get every episode in your inbox
          </h2>
          <p className="max-w-md text-white/70">
            New episodes, gear picks, and no spam. Straight from the Juice Bros.
          </p>
          <div className="mt-2 flex w-full justify-center [&_input]:bg-white/5 [&_input]:text-white [&_input]:border-white/20 [&_input]:placeholder:text-white/40">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </div>
  );
}
