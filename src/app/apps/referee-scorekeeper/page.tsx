import type { Metadata } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { ComingSoon } from "@/components/apps/coming-soon";

const app = apps.find((item) => item.slug === "referee-scorekeeper")!;

export const metadata: Metadata = pageMetadata({
  title: app.title,
  description: app.description,
  path: app.href,
});

export default function RefereeScorekeeperPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Pickleball Tools"
        title={app.title}
        description={app.description}
      />
      <ComingSoon icon={app.icon} />
    </div>
  );
}
