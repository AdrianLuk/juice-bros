import type { GearItem, HostGear } from "@/data/gear";
import { GearGrid } from "../gear-card";

/**
 * One host's gear, split into what they're playing with now and what else is
 * in the bag.
 *
 * The two subsection labels are real headings at the shelf step, not the
 * incumbent's tracked uppercase micro-labels. A label sitting above a grid is
 * that grid's title; setting it in metadata type made the page's structure
 * read as a run of captions, and buried whose gear you were looking at.
 */
function Subsection({ label, items }: { label: string; items: GearItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-9">
      <h3 className="bx-h2 text-base sm:text-lg">{label}</h3>
      <div className="mt-5">
        <GearGrid items={items} />
      </div>
    </div>
  );
}

export function HostGearSection({ host }: { host: HostGear }) {
  const total = host.current.length + host.bag.length;

  return (
    <section className="bx-hair py-14 sm:py-20">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">
        What {host.name} plays with
      </h2>
      <p className="bx-meta mt-2.5">
        {total} item{total === 1 ? "" : "s"}
      </p>
      <Subsection label="Currently using" items={host.current} />
      <Subsection label="Also in the bag" items={host.bag} />
    </section>
  );
}
