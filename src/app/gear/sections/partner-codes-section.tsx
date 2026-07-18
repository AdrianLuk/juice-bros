import type { GearItem } from "@/data/gear";
import { SectionHeading } from "@/components/typography/section-heading";
import { GearCard } from "../gear-card";

export function PartnerCodesSection({ items }: { items: GearItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16">
      <SectionHeading title="More Codes" weight="semibold" />
      <p className="mt-2 text-muted-foreground">
        Brands we&apos;ve partnered with but don&apos;t currently game — our codes
        still work if you want to try them.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <GearCard key={item.name} item={item} />
        ))}
      </div>
    </section>
  );
}
