import Image from "next/image";

export function Hero() {
  return (
    <section className="w-full bg-brand-orange px-4 pt-12 pb-16 text-white sm:px-6 sm:pt-28 sm:pb-20 lg:pt-32">
      <div className="mx-auto grid w-full max-w-6xl gap-12 sm:grid-cols-2 sm:items-center">
        <div className="flex flex-col gap-5">
          <h1 className="font-heading text-4xl font-black tracking-[-0.03em] text-balance sm:text-6xl">
            Two friends who couldn&apos;t stop talking about pickleball
          </h1>
          <p className="text-xl font-medium text-white text-balance sm:text-2xl">
            So we hit record. Juice Bros is a podcast, a community, and - most days - a
            group chat that got a little out of hand. All for the everyday player who
            just wants to feel like they&apos;re part of something.
          </p>
        </div>
        <div className="rounded-[2rem] bg-white/10 p-2 ring-1 ring-white/15">
          <Image
            src="/brand/JB_Banner.jpeg"
            alt="The Juice Bros"
            width={1600}
            height={900}
            sizes="(min-width: 640px) 50vw, 100vw"
            className="aspect-video w-full rounded-[1.6rem] object-cover"
          />
        </div>
      </div>
    </section>
  );
}
