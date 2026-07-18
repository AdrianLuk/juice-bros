import { Eyebrow } from "@/components/typography/eyebrow";

export function Mission() {
  return (
    <section className="w-full bg-brand-black text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-6 lg:px-8">
        <Eyebrow color="yellow">Why We Do This</Eyebrow>
        <p className="font-heading text-3xl font-black tracking-tight text-balance sm:text-5xl">
          To create the most relatable pickleball conversations on the internet.
        </p>
        <div className="flex flex-col gap-4 text-lg text-white/80 text-balance">
          <p>
            We&apos;re not here to fix your third shot drop or rank the best paddles of
            2026 - there are plenty of people already doing that, and doing it better
            than we would.
          </p>
          <p>
            We&apos;re here for everything else: the psychology, the friendships, the
            rivalry that started over one bad line call, the pre-tournament nerves, the
            post-tournament food. The stuff that happens before, during, and after every
            game - the stuff that actually makes this sport what it is.
          </p>
          <p>
            If pickleball content has ever felt like it was made for someone way more
            serious than you, this is the show that isn&apos;t.
          </p>
        </div>
      </div>
    </section>
  );
}
