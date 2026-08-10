import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { ComingSoon } from "@/components/apps/coming-soon";

// Apps with their own dedicated route folder (e.g. src/app/tools/referee-scorekeeper)
// are excluded here so this catch-all doesn't also prerender their slug.
const DEDICATED_ROUTE_SLUGS = new Set(["referee-scorekeeper"]);

export function generateStaticParams() {
  return apps
    .filter((app) => !DEDICATED_ROUTE_SLUGS.has(app.slug))
    .map((app) => ({ slug: app.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const app = apps.find((item) => item.slug === slug);
  if (!app) notFound();

  return pageMetadata({
    title: app.title,
    description: app.description,
    path: app.href,
  });
}

export default async function AppPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const app = apps.find((item) => item.slug === slug);
  if (!app) notFound();

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
