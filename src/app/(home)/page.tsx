import Link from "next/link";

import { siteConfig } from "@/config/site";
import { getYoutubeEmbedUrl } from "@/lib/utils";
import { getEpisodeHook, getLatestVideos } from "@/lib/youtube";
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

// TODO: Swap for a distinct candid shot of Daven & Adrian. Currently reuses the
// hero banner, which shows the same faces already featured at the top of the page.
const hostPhoto = "/pictures/adrian-dav-chatgpt-edited.png";

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
  // First item is the feature card up top; the rest fill the grid below.
  const [featuredVideo, ...restVideos] = await getLatestVideos(7);

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

      {/* Latest episode — feature card */}
      {featuredVideo && (
        <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-3xl border bg-brand-black text-white lg:grid-cols-2">
            {/* Video */}
            <div className="aspect-video lg:min-h-120">
              <iframe
                className="h-full w-full"
                src={getYoutubeEmbedUrl(featuredVideo.url)}
                title={featuredVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {/* Host photo + episode details */}
            <div className="relative flex flex-col justify-center gap-6 p-8 sm:p-10 lg:p-12">
              {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
              <img
                src={hostPhoto}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-30"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-t from-brand-black via-brand-black/85 to-brand-black/55"
              />
              <div className="relative flex flex-col gap-5">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold tracking-[0.15em] text-white uppercase">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                    <span className="relative inline-flex size-2 rounded-full bg-white" />
                  </span>
                  New Episode
                </span>
                <div>
                  <h2 className="font-heading text-3xl font-black tracking-tight text-balance sm:text-4xl">
                    {featuredVideo.title}
                  </h2>
                  {featuredVideo.description && (
                    <p className="mt-3 text-lg text-white/85 text-balance">
                      {getEpisodeHook(featuredVideo.description)}
                    </p>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    nativeButton={false}
                    className="h-11 bg-[#ff0000] px-6 text-base text-white hover:bg-[#d90000]"
                    render={<a href={featuredVideo.url} target="_blank" rel="noopener noreferrer" />}
                  >
                    <YoutubeIcon className="size-5" />
                    Watch on YouTube
                  </Button>
                  <Button
                    size="lg"
                    nativeButton={false}
                    className="h-11 bg-[#1db954] px-6 text-base text-white hover:bg-[#1aa64c]"
                    render={<a href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer" />}
                  >
                    <SpotifyIcon className="size-5" />
                    Listen on Spotify
                  </Button>
                </div>
                <Link
                  href="/podcast"
                  className="w-fit text-sm font-medium text-white/60 transition-colors hover:text-white"
                >
                  Browse all episodes &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Latest videos */}
      {restVideos.length > 0 && (
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
            <VideoGrid videos={restVideos} />
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
