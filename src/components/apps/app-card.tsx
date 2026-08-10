import Link from "next/link";

import type { AppItem } from "@/data/apps";

export function AppCard({ app }: { app: AppItem }) {
  const { icon: Icon } = app;
  return (
    <Link
      href={app.href}
      className="group flex flex-col rounded-xl border p-4 transition-colors hover:border-brand-orange"
    >
      <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border bg-brand-orange/5">
        <Icon className="size-10 text-brand-orange/40" />
      </div>
      <p className="mt-4 font-heading text-lg font-semibold transition-colors group-hover:text-brand-orange">
        {app.title}
      </p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">
        {app.description}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        {app.status === "coming-soon" ? (
          <span className="rounded-md border border-brand-orange/40 bg-brand-orange/10 px-2 py-0.5 text-sm font-semibold text-brand-orange">
            Coming Soon
          </span>
        ) : (
          <span />
        )}
        <span className="text-sm font-medium underline-offset-4 group-hover:underline">
          View →
        </span>
      </div>
    </Link>
  );
}
