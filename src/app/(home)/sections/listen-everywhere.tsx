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
    <section className="border-y bg-muted/40">
      <div className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading title="Listen everywhere" align="center" responsive={false} />
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
  );
}
