import Link from "next/link";

import { picklePointPalFaqs } from "@/data/pickle-point-pal-content";

/**
 * Crawlable explainer + FAQ shown below the tool. Server-rendered so the copy
 * is in the initial HTML. Styled against `.pp-surface`'s locked-light palette
 * with explicit neutral tokens rather than the theme-driven ones.
 */
export function PicklePointPalAbout() {
  return (
    <section className="mx-auto mt-16 w-full max-w-2xl border-t border-neutral-200 pt-12 text-neutral-600">
      <p className="font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        About
      </p>
      <h2 className="mt-2 font-heading text-2xl font-bold text-neutral-950">
        A pickleball scorekeeper that thinks like a referee
      </h2>
      <p className="mt-4">
        Pickle Point Pal is a free pickleball scorekeeping app for the person
        holding the phone at the net. Set the format, run the coin toss, and tap
        one button per rally &mdash; it does the rest: the full three-number
        score call, server 1 and server 2 through every side-out, the mid-game
        side switch, standard and medical timeouts with a clock that survives a
        screen lock, and technical warnings and fouls. It works for singles and
        doubles, side-out or rally scoring, one game or best of five.
      </p>
      <p className="mt-4">
        No account, no install, no ads. It runs in your browser and keeps
        working offline once you&apos;ve loaded it, so a dead signal at the court
        doesn&apos;t cost you the match. Every tap is undoable, and a running
        match log records what happened if a score is ever questioned.
      </p>

      <h3 className="mt-10 font-heading text-lg font-bold text-neutral-950">
        How pickleball scoring works
      </h3>
      <p className="mt-3">
        In side-out (traditional) scoring, only the serving team can score a
        point. A doubles score is called as three numbers &mdash; serving
        team&apos;s score, receiving team&apos;s score, and whether the current
        server is the first or second server for that team. Both players on a
        team serve before the serve passes to the other side, except for the
        very first service turn of the game. Rally scoring awards a point on
        every rally regardless of who served, which makes games faster and the
        math simpler. Pickle Point Pal keeps the call straight in either format
        so you can watch the court instead of doing arithmetic.
      </p>

      <h3 className="mt-10 font-heading text-lg font-bold text-neutral-950">
        Questions
      </h3>
      <dl className="mt-4 divide-y divide-neutral-200">
        {picklePointPalFaqs.map((faq) => (
          <div key={faq.question} className="py-4 first:pt-0 last:pb-0">
            <dt className="font-semibold text-neutral-950">{faq.question}</dt>
            <dd className="mt-1.5">{faq.answer}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-sm">
        Pickle Point Pal is one of the free{" "}
        <Link
          href="/tools"
          className="font-medium text-brand-orange underline underline-offset-4"
        >
          pickleball tools
        </Link>{" "}
        from Juice Bros Pickleball, a podcast for everyday players. New to the
        show? Start with the{" "}
        <Link
          href="/podcast"
          className="font-medium text-brand-orange underline underline-offset-4"
        >
          episodes
        </Link>
        .
      </p>
    </section>
  );
}
