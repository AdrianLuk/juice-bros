import type { Metadata } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { buildToolsJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { PageHeading } from "@/components/typography/page-heading";
import { AppCard } from "@/components/apps/app-card";

export const metadata: Metadata = pageMetadata({
  title: "Tools",
  description:
    "Free browser-based pickleball tools from Juice Bros Pickleball. Plan games with friends, plus scorekeeping and serve tracking like a ref.",
  path: "/tools",
});

export default function ToolsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-20 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildToolsJsonLd(apps)) }}
      />
      <PageHeading
        eyebrow="Pickleball Tools"
        title="Tools"
        description="Free tools we're building for everyday players. More on the way."
      />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {apps.map((app) => (
          <AppCard key={app.slug} app={app} />
        ))}
      </div>
    </div>
  );
}
