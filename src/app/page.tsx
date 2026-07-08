import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { episodes } from "@/data/episodes";
import { getYoutubeEmbedUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "@/components/newsletter-form";
import { YoutubeIcon, SpotifyIcon, InstagramIcon } from "@/components/icons";

const socialLinks = [
  { name: "YouTube", href: siteConfig.links.youtube, icon: YoutubeIcon },
  { name: "Spotify", href: siteConfig.links.spotify, icon: SpotifyIcon },
  { name: "Instagram", href: siteConfig.links.instagram, icon: InstagramIcon },
];

export default function Home() {
  const featuredEpisode =
    episodes.find((episode) => episode.featured) ?? episodes[0];

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-black text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--brand-orange),transparent_75%),transparent_60%)]"
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
          <Image
            src="/brand/logo.jpg"
            alt={siteConfig.name}
            width={112}
            height={112}
            priority
            className="rounded-full border-2 border-brand-orange"
          />
          <p className="text-sm font-semibold tracking-[0.2em] text-brand-yellow uppercase">
            The Podcast
          </p>
          <h1 className="max-w-2xl font-heading text-4xl font-black tracking-tight text-balance sm:text-6xl">
            Juice Bros Pickleball
          </h1>
          <p className="max-w-xl text-lg text-white/70 text-balance">
            {siteConfig.description}
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              className="h-11 px-6 text-base"
              render={<a href={siteConfig.links.youtube} target="_blank" rel="noopener noreferrer" />}
            >
              Watch Latest Episode
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              className="h-11 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
              render={<a href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer" />}
            >
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
                className="text-white/60 transition-colors hover:text-brand-yellow"
              >
                <social.icon className="size-6" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Latest episode */}
      {featuredEpisode && (
        <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
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
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand-orange"
                >
                  <SpotifyIcon className="size-4" />
                  Listen on Spotify
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Listen everywhere */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-heading text-2xl font-bold tracking-tight">
            Listen everywhere
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-3 rounded-xl border bg-background px-6 py-5 font-medium transition-colors hover:border-brand-orange hover:text-brand-orange"
              >
                <social.icon className="size-5" />
                {social.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-brand-black text-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
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
