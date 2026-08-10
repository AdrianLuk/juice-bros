import type { Metadata } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { AppCard } from "@/components/apps/app-card";

export const metadata: Metadata = pageMetadata({
  title: "Apps",
  description:
    "Free pickleball tools from Juice Bros Pickleball.",
  path: "/apps",
});

export default function AppsPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Pickleball Tools"
        title="Apps"
        description="Free tools we're building for everyday players. More on the way."
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <AppCard key={app.slug} app={app} />
        ))}
      </div>
    </div>
  );
}
