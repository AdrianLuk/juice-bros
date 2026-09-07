import type { Appearance } from "@/lib/appearances";
import { AppearanceRow } from "./appearance-row";
import { PastDisclosure } from "./past-disclosure";

export function PastAppearances({ appearances }: { appearances: Appearance[] }) {
  if (appearances.length === 0) {
    return (
      <section className="bx-hair py-14 sm:py-20">
        <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">Already played</h2>
        <p className="bx-lead mt-5">
          Nothing here yet. Once we&apos;ve played a few, they&apos;ll live here
          with recaps.
        </p>
      </section>
    );
  }

  return (
    <PastDisclosure count={appearances.length}>
      <ul className="mt-7 flex flex-col gap-4">
        {appearances.map((appearance) => (
          <AppearanceRow key={appearance.name} appearance={appearance} tone="past" />
        ))}
      </ul>
    </PastDisclosure>
  );
}
