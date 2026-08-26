import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

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

export function ListenEverywhere() {
  return (
    <section className="bg-muted/50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading title="Listen everywhere" align="center" responsive={false} />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {listenLinks.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-xl font-bold text-white shadow-brand transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:translate-y-0 ${social.cardClass}`}
            >
              <social.icon className="size-5" />
              {social.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
