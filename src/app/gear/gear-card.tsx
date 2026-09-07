"use client";

import { track } from "@vercel/analytics";

import { GearCategory, type GearItem } from "@/data/gear";

/**
 * A piece of gear one of the hosts actually plays with.
 *
 * The image sits on a white plate rather than the raised fill every other tile
 * uses. Paddles, grips and shoes are all photographed on white by the brands
 * that sell them, so a `cover` crop on a dark card would be a crop of someone
 * else's studio backdrop with the product lost in the middle of it. `.bx-plate`
 * gives it white and `contain`; it is still a `.bx-tile`, so it lifts, rings
 * and shadows exactly like an episode thumbnail. The colour on this page comes
 * from the products, the same way the home page's comes from the thumbnails.
 *
 * The discount code is a `.bx-chip` in ink, not brand orange. Orange has three
 * jobs on this site already (the pill nav, the mobile corner button, the focus
 * ring) and the incumbent's orange-on-orange code pill would have made it a
 * fourth - on the one page where the products need to be the loudest thing.
 */
function GearImage({ item }: { item: GearItem }) {
  if (item.image) {
    // Only a genuinely white-ground product shot gets the white plate. The
    // grip photos carry their own dark and grey backgrounds, and on a plate
    // they rendered as black rectangles floating inside white boxes - three of
    // five cards, and a stack of white slabs at 390.
    const ground = item.imageHasOwnGround ? "" : " bx-plate";
    return (
      <div className={`bx-tile aspect-[4/3]${ground}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote brand CDN asset, no next/image optimization needed */}
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          className={item.imageHasOwnGround ? "object-contain p-3.5" : undefined}
        />
      </div>
    );
  }
  // No photograph from the brand: the initial on the raised fill, rather than
  // a broken frame or a stock placeholder.
  return (
    <div className="bx-tile flex aspect-[4/3] items-center justify-center">
      <span className="text-4xl font-bold text-[var(--bx-line-2)]">
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
      rel="sponsored noopener noreferrer"
      onClick={() =>
        track("gear_click", { name: item.name, category: item.category, code: item.code })
      }
      // `w-full` inside a stretched flex `<li>`: the anchor fills its grid
      // row's height, so the `flex-1` blurb below can push every card's code
      // chip and Shop link onto one baseline across the row.
      className="group flex w-full flex-col"
    >
      <GearImage item={item} />

      <h4 className="mt-4 text-[1.0625rem] leading-snug font-semibold transition-colors duration-200 group-hover:text-[var(--bx-muted)]">
        {item.name}
      </h4>
      <p className="bx-meta mt-1.5">{item.category}</p>
      <p className="mt-2.5 flex-1 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
        {item.blurb}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {item.code && (
          <span className="bx-chip">
            <span className="sr-only">Discount code </span>
            {item.code}
          </span>
        )}
        <span className="bx-actionlink ml-auto">
          Shop
          <span aria-hidden className="bx-arrow">
            &rarr;
          </span>
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
    <ul className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      {ordered.map((item) => (
        <li key={item.name} className="flex">
          <GearCard item={item} />
        </li>
      ))}
    </ul>
  );
}
