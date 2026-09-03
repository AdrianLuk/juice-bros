import type { Metadata } from "next";
import {
  Anton,
  Bricolage_Grotesque,
  Caveat,
  Geist,
  Geist_Mono,
  Libre_Franklin,
  Saira_Condensed,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { siteConfig } from "@/config/site";
import { buildOrganizationJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteChromeSlot } from "@/components/layout/site-chrome-slot";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// On Deck's arena surfaces (the live-event board, floor screen, display,
// kiosk) run an engineered, condensed sport-signage face — the lettering of a
// substitution board and a scoreboard, sized to be read across a loud gym.
// Scoped to `.od-arena` in globals.css; the rest of the site never sees it.
const sairaCondensed = Saira_Condensed({
  variable: "--font-saira-condensed",
  weight: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// Booking Buddy's new visual world (direction seed 861cf732) — "the well-kept
// rec-hall bulletin board". Anton is the screen-printed notice voice: the
// routed "COURTS" nav sign, masking-tape section labels, card date stamps, the
// sign-up-sheet masthead, big spot-count numerals. Libre Franklin (a Franklin
// Gothic-lineage humanist grotesque, municipal-notice character) is the single
// workhorse for headings, body, UI and table data. Caveat is pen marks only —
// RSVP tallies, "FULL", quick notes. All scoped to `.bb-theme` in globals.css;
// the marketing site never sees them.
const anton = Anton({
  variable: "--font-bb-sign",
  weight: "400",
  subsets: ["latin"],
});

const libreFranklin = Libre_Franklin({
  variable: "--font-bb-body",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-bb-hand",
  weight: ["600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.tagline,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: siteConfig.url,
    title: siteConfig.tagline,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.tagline,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `globals.css` sets `scroll-behavior: smooth` on <html>; this tells
      // Next to suspend it for the scroll-restoration jump on a route change
      // so it doesn't animate against the page/View Transition.
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${bricolage.variable} ${geistMono.variable} ${sairaCondensed.variable} ${anton.variable} ${libreFranklin.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/* Mark JS as live before first paint so scroll-reveal sections can
            start hidden without a no-JS render ever hiding content. */}
        <script
          dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add("js")` }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildOrganizationJsonLd()) }}
        />
        <a
          href="#main-content"
          className="sr-only z-50 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <div aria-hidden className="bg-noise" />
        {/* Suppressed on /booking-buddy — a standalone app shell with its own
            nav (ADR 0016). Still shown on /s/[token], the Guest Slot Link. */}
        <SiteChromeSlot>
          <SiteHeader />
        </SiteChromeSlot>
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteChromeSlot>
          <SiteFooter />
        </SiteChromeSlot>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
