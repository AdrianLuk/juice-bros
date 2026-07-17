import type { Metadata } from "next";

import { pillars } from "@/data/about";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
        Who We Are
      </p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        About Juice Bros Pickleball
      </h1>

      <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
        <img
          src="/brand/JB_Banner.jpeg"
          alt="The Juice Bros"
          width={1600}
          height={900}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Juice Bros Pickleball started the way most good ideas do — two friends who
            couldn&apos;t stop talking about pickleball decided to hit record. What began as
            court-side rants turned into a podcast about the game, the gear, and the culture
            growing up around it.
          </p>
          <p className="text-muted-foreground">
            We&apos;re not pros. We&apos;re paddle-obsessed regulars who talk to the players,
            brands, and characters shaping the sport, and bring it back to you every week.
          </p>
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <div key={pillar.label} className="rounded-xl border p-6">
            <p className="font-heading text-lg font-semibold text-brand-orange">
              {pillar.label}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{pillar.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
