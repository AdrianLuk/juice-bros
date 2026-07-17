import { siteConfig } from "@/config/site";
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

export function SiteFooter() {
  return (
    <footer className="bg-brand-black text-white">
      <div className="flex w-full flex-col-reverse items-center gap-4 border-t border-white/10 px-4 py-8 text-sm text-white/60 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
          <img src="/brand/JB_Logo_White.svg" alt="" className="h-5 w-5" />
          &copy; {new Date().getFullYear()} {siteConfig.name}
        </p>
        <nav className="flex items-center gap-5">
          {socialLinks.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.name}
              className={`text-white/60 transition-colors ${social.hoverClass}`}
            >
              <social.icon className="size-5" />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
