import { Eyebrow } from "@/components/typography/eyebrow";

export function Hero() {
  return (
    <section className="w-full overflow-x-clip bg-brand-orange px-4 pt-12 pb-16 text-white sm:px-6 sm:pt-28 sm:pb-20 lg:pt-32">
      <div className="mx-auto grid w-full max-w-6xl gap-12 sm:grid-cols-2 sm:items-center">
        <div className="flex flex-col gap-5">
          <Eyebrow color="yellow" className="jb-in">Who We Are</Eyebrow>
          <h1 className="jb-in jb-in-2 font-heading text-4xl font-black tracking-[-0.03em] text-balance sm:text-6xl">
            Two friends who couldn&apos;t stop talking about pickleball
          </h1>
          <p className="jb-in jb-in-3 text-lg text-white/80 text-balance">
            So we hit record. Juice Bros is a podcast, a community, and - most days - a
            group chat that got a little out of hand. All for the everyday player who
            just wants to feel like they&apos;re part of something.
          </p>
        </div>
        <div className="jb-hero-img-x rounded-[2rem] bg-white/10 p-2 ring-1 ring-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
          <img
            src="/brand/JB_Banner.jpeg"
            alt="The Juice Bros"
            width={1600}
            height={900}
            className="aspect-video w-full rounded-[1.6rem] object-cover"
          />
        </div>
      </div>
    </section>
  );
}
