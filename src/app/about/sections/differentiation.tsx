import { Eyebrow } from "@/components/typography/eyebrow";

export function Differentiation() {
  return (
    <section className="w-full bg-brand-black">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-20 text-center text-white sm:px-6 lg:px-8">
        <div>
          <Eyebrow color="yellow">Not Pros. Not Coaches.</Eyebrow>
          <h2 className="mt-3 font-heading text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
            We&apos;re not the guys who made it to the tour
          </h2>
        </div>
        <div className="flex flex-col gap-4 text-white/75">
          <p>
            Okay - we&apos;ve picked up a few things watching from the sidelines. But
            that&apos;s not why you&apos;re here.
          </p>
          <p>
            Most pickleball shows are hosted by people who&apos;ve already arrived - tour
            pros, certified coaches, ex-athletes who traded their ranking for a
            microphone. Great show. Just not this one. Daven and Adrian are rec players
            who lose to the same teams you do, argue about the same line calls you do,
            and fight for the same 8:00pm court booking every week.
          </p>
          <p className="font-medium text-white">
            If that sounds more like your Tuesday night than a tour stop, you&apos;re
            exactly who this is for.
          </p>
        </div>
      </div>
    </section>
  );
}
