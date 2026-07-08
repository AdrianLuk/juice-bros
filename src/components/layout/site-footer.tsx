import Link from "next/link";

import { siteConfig } from "@/config/site";
import { NewsletterForm } from "@/components/newsletter-form";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-heading text-base font-semibold">Get the newsletter</p>
            <p className="text-sm text-muted-foreground">
              New episodes, gear picks, and no spam.
            </p>
          </div>
          <NewsletterForm />
        </div>

        <div className="flex flex-col gap-4 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.name}
          </p>
          <nav className="flex gap-4">
            <Link href={siteConfig.links.youtube} target="_blank" rel="noopener noreferrer">
              YouTube
            </Link>
            <Link href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer">
              Spotify
            </Link>
            <Link href={siteConfig.links.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
