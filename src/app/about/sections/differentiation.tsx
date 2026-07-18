import { Eyebrow } from "@/components/typography/eyebrow";

export function Differentiation() {
  return (
    <section className="w-full bg-brand-black">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center text-white sm:px-6 lg:px-8">
        <div>
          <Eyebrow color="yellow">Not Another Instructional Channel</Eyebrow>
          <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            We&apos;re not really trying to make you better at pickleball
          </h2>
        </div>
        <div className="flex flex-col gap-4 text-white/85">
          <p>Okay - maybe a little better. But that&apos;s not the point.</p>
          <p>
            There&apos;s no shortage of paddle reviews, ranking debates, and &ldquo;fix
            your dink in 60 seconds&rdquo; videos out there, and we leave that to the
            coaches and the pros. Juice Bros exists for the players who show up for the
            people as much as the game - the ones who&apos;d rather talk about the
            wildest match they&apos;ve ever played than their spin rate.
          </p>
          <p className="font-medium text-white">
            If that&apos;s you, you&apos;re exactly who this is for.
          </p>
        </div>
      </div>
    </section>
  );
}
