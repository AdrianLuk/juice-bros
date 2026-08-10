import Link from "next/link";

import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="mt-12 flex flex-col items-center rounded-xl border border-dashed p-12 text-center">
      <Icon className="size-10 text-brand-orange/40" />
      <p className="mt-4 font-heading text-lg font-semibold">
        This tool is in the works
      </p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We&apos;re still building this one. Check back soon, or browse the
        other tools in the meantime.
      </p>
      <Link
        href="/apps"
        className="mt-6 text-sm font-medium text-brand-orange underline-offset-4 hover:underline"
      >
        ← Back to Apps
      </Link>
    </div>
  );
}
