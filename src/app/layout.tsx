import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
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
      className={`${geist.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
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
