import { Eyebrow } from "@/components/typography/eyebrow";

export function Hero() {
  return (
    <section className="w-full bg-brand-orange px-4 pt-16 pb-4 text-white sm:px-6 lg:px-8">
      <div className="grid gap-10 sm:grid-cols-2 sm:items-center">
        <div className="flex flex-col gap-4">
          <Eyebrow color="yellow">Who We Are</Eyebrow>
          <h1 className="font-heading text-3xl font-black tracking-tight text-balance sm:text-5xl">
            Two friends who couldn&apos;t stop talking about pickleball
          </h1>
          <p className="text-lg text-white/80 text-balance">
            So we hit record. Juice Bros is a podcast, a community, and - most days - a
            group chat that got a little out of hand. All for the everyday player who
            just wants to feel like they&apos;re part of something.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
        <img
          src="/brand/JB_Banner.jpeg"
          alt="The Juice Bros"
          width={1600}
          height={900}
          className="aspect-video w-full rounded-2xl border border-white/20 object-cover"
        />
      </div>
    </section>
  );
}
