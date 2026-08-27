import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { apps, type AppItem } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { ComingSoon } from "@/components/apps/coming-soon";

// Slugs Next resolves through a dedicated route folder
// (e.g. src/app/tools/pickle-point-pal) rather than this catch-all.
const DEDICATED_ROUTE_SLUGS = new Set(["pickle-point-pal"]);

// This catch-all only renders the "coming soon" stub for apps whose canonical
// route is /tools/<slug>. An app hosted on its own path (Booking Buddy at
// /booking-buddy) is still matched by slug below, then redirected to where it
// actually lives.
function isCatchAllApp(app: AppItem): boolean {
  return app.href === `/tools/${app.slug}` && !DEDICATED_ROUTE_SLUGS.has(app.slug);
}

export function generateStaticParams() {
  return apps.filter(isCatchAllApp).map((app) => ({ slug: app.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const app = apps.find((item) => item.slug === slug);
  if (!app) notFound();
  if (app.href !== `/tools/${slug}`) redirect(app.href);

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
  if (app.href !== `/tools/${slug}`) redirect(app.href);

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
