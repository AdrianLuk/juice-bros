import type { Metadata } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { AppCard } from "@/components/apps/app-card";

export const metadata: Metadata = pageMetadata({
  title: "Tools",
  description:
    "Free pickleball tools from Juice Bros Pickleball.",
  path: "/tools",
});

export default function ToolsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-20 sm:px-6 lg:px-8">
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
