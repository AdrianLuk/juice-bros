import type { Appearance } from "@/lib/appearances";
import { AppearanceRow } from "./appearance-row";
import { PastDisclosure } from "./past-disclosure";

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
    <PastDisclosure count={appearances.length}>
      <ul className="mt-4 flex flex-col gap-3">
        {appearances.map((appearance) => (
          <AppearanceRow key={appearance.name} appearance={appearance} tone="past" />
        ))}
      </ul>
    </PastDisclosure>
  );
}
