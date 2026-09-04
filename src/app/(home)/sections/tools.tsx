import Link from "next/link";

import { apps } from "@/data/apps";
import { RevealGroup } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/typography/section-heading";
import { AppCard } from "@/components/apps/app-card";

export function Tools() {
  if (apps.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <SectionHeading eyebrow="Pickleball Tools" title="Tools we're building" />
          <p className="mt-3 text-muted-foreground">
            Free browser tools for everyday players. More on the way.
          </p>
        </div>
        <Link
          href="/tools"
          className="text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          View all tools &rarr;
        </Link>
      </div>
      <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2">
        {apps.map((app) => (
          <AppCard key={app.slug} app={app} />
        ))}
      </RevealGroup>
    </section>
  );
}
