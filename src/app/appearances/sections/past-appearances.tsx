import { ChevronRight } from "lucide-react";

import type { Appearance } from "@/lib/appearances";
import { AppearanceRow } from "./appearance-row";

export function PastAppearances({ appearances }: { appearances: Appearance[] }) {
  if (appearances.length === 0) {
    return (
      <section className="mt-14 border-t border-border pt-8">
        <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">Past</h2>
        <p className="mt-4 text-muted-foreground">
          No past appearances yet. Once we&apos;ve played a few, they&apos;ll live
          here with recaps.
        </p>
      </section>
    );
  }

  return (
    <details className="group mt-14 border-t border-border pt-8">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-heading text-2xl font-semibold tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        Past
        <span className="text-base font-medium text-muted-foreground">
          ({appearances.length})
        </span>
      </summary>
      <ul className="mt-2 divide-y divide-border">
        {appearances.map((appearance) => (
          <AppearanceRow key={appearance.name} appearance={appearance} tone="past" />
        ))}
      </ul>
    </details>
  );
}
