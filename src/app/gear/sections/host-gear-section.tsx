import type { GearItem, HostGear } from "@/data/gear";
import { SectionHeading } from "@/components/typography/section-heading";
import { GearGrid } from "../gear-card";

function Subsection({ label, items }: { label: string; items: GearItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </h3>
      <div className="mt-4">
        <GearGrid items={items} />
      </div>
    </div>
  );
}

export function HostGearSection({ host }: { host: HostGear }) {
  return (
    <section className="mt-16">
      <SectionHeading title={`${host.name}'s Gear`} weight="semibold" />
      <Subsection label="Currently Using" items={host.current} />
      <Subsection label="What's in the Bag" items={host.bag} />
    </section>
  );
}
