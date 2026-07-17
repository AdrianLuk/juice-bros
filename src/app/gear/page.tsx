import type { Metadata } from "next";

import {
  GearCategory,
  hosts,
  partnerCodes,
  type GearItem,
  type HostGear,
} from "@/data/gear";

export const metadata: Metadata = {
  title: "Gear",
};

function GearImage({ item }: { item: GearItem }) {
  if (item.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote brand CDN asset, no next/image optimization needed
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        className="aspect-4/3 w-full rounded-lg border bg-white object-contain p-3"
      />
    );
  }
  return (
    <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border bg-brand-orange/5">
      <span className="font-heading text-4xl font-bold text-brand-orange/40">
        {item.name.charAt(0)}
      </span>
    </div>
  );
}

function GearCard({ item }: { item: GearItem }) {
  // Shopify auto-applies a code at /discount/<code>?redirect=<path>, landing the
  // shopper on the specific product page with the discount already in their cart.
  const url = new URL(item.url);
  const href = item.code
    ? `${url.origin}/discount/${item.code}?redirect=${url.pathname}${url.search}`
    : item.url;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border p-4 transition-colors hover:border-brand-orange"
    >
      <GearImage item={item} />
      <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-brand-orange uppercase">
        {item.category}
      </p>
      <p className="mt-1 font-heading text-lg font-semibold transition-colors group-hover:text-brand-orange">
        {item.name}
      </p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.blurb}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Code</span>
          <span className="rounded-md border border-brand-orange/40 bg-brand-orange/10 px-2 py-0.5 font-mono font-semibold text-brand-orange">
            {item.code}
          </span>
        </span>
        <span className="text-sm font-medium underline-offset-4 group-hover:underline">
          Shop →
        </span>
      </div>
    </a>
  );
}

function Subsection({ label, items }: { label: string; items: GearItem[] }) {
  if (items.length === 0) return null;
  // Paddles first; stable sort keeps the rest in their original order.
  const ordered = [...items].sort(
    (a, b) =>
      Number(b.category === GearCategory.Paddle) -
      Number(a.category === GearCategory.Paddle),
  );
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </h3>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((item) => (
          <GearCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

function HostSection({ host }: { host: HostGear }) {
  return (
    <section className="mt-16">
      <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {host.name}&apos;s Gear
      </h2>
      <Subsection label="Currently Using" items={host.current} />
      <Subsection label="What's in the Bag" items={host.bag} />
    </section>
  );
}

export default function GearPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
        What We Play With
      </p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        Gear
      </h1>
      <p className="mt-2 text-muted-foreground">
        The paddles, apparel, and accessories we actually use — plus our ambassador
        codes for a discount. We only share products we genuinely play with and believe in.
      </p>

      {hosts.map((host) => (
        <HostSection key={host.name} host={host} />
      ))}

      {partnerCodes.length > 0 && (
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            More Codes
          </h2>
          <p className="mt-2 text-muted-foreground">
            Brands we&apos;ve partnered with but don&apos;t currently game — our codes
            still work if you want to try them.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {partnerCodes.map((item) => (
              <GearCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-16 text-xs text-muted-foreground">
        Affiliate disclosure: some products featured have ambassador discount codes
        available. We only share products we genuinely use and believe in.
      </p>
    </div>
  );
}
