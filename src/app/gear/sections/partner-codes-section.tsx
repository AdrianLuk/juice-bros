import type { GearItem } from "@/data/gear";
import { GearGrid } from "../gear-card";

/**
 * Brands the hosts have a code with but don't currently play. Kept honest and
 * kept separate: mixing these into a host's own list would make "what we
 * actually use" mean less on the one page where that claim is the product.
 */
export function PartnerCodesSection({ items }: { items: GearItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bx-hair py-14 sm:py-20">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">
        Codes we still have
      </h2>
      <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
        Brands we&apos;ve partnered with but don&apos;t currently game. The
        codes still work if you want to try them.
      </p>
      <div className="mt-8">
        <GearGrid items={items} />
      </div>
    </section>
  );
}
