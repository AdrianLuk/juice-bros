import { GearCategory, type GearItem } from "@/data/gear";
import { Eyebrow } from "@/components/typography/eyebrow";

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

export function GearCard({ item }: { item: GearItem }) {
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
      <Eyebrow size="xs" className="mt-4">
        {item.category}
      </Eyebrow>
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

export function GearGrid({ items }: { items: GearItem[] }) {
  if (items.length === 0) return null;
  // Paddles first; stable sort keeps the rest in their original order.
  const ordered = [...items].sort(
    (a, b) =>
      Number(b.category === GearCategory.Paddle) -
      Number(a.category === GearCategory.Paddle),
  );
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {ordered.map((item) => (
        <GearCard key={item.name} item={item} />
      ))}
    </div>
  );
}
