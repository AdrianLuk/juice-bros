import Link from "next/link";

import { picklePointPalFaqs } from "@/data/pickle-point-pal-content";

/**
 * Crawlable explainer + FAQ shown below the tool — the instrument's manual.
 * Server-rendered so the copy is in the initial HTML. Styled against
 * `.pp-surface`'s locked-light officiating palette, in a spec-sheet register:
 * engraved section rules, legend-voice headers, mono for the reference data.
 */
export function PicklePointPalAbout() {
  return (
    <section className="mx-auto mt-16 w-full max-w-2xl border-t-2 border-pp-frame/15 pt-10 text-pp-ink-dim">
      <h2 className="pp-plate text-2xl text-pp-ink">
        A pickleball scorekeeper that thinks like a referee
      </h2>
      <p className="mt-4">
        Pickle Point Pal is a free pickleball scorekeeping app for whoever ends
        up keeping score at the net. You set the format and run the coin toss,
        then tap one key per rally. It tracks the full three-number score call,
        server 1 and server 2 through every side-out, the mid-game side switch,
        standard and medical timeouts on a clock that survives a screen lock,
        and technical warnings and fouls. It works for singles and doubles,
        side-out or rally scoring, a single game or best of five.
      </p>
      <p className="mt-4">
        There&apos;s no account to make and nothing to install, and it
        doesn&apos;t run ads. It works in your browser and keeps going offline
        once the page has loaded, so a dead signal at the court won&apos;t cost
        you the match. Every tap can be undone, and a running match log keeps a
        record you can point to if a score is ever questioned.
      </p>

      <span className="mt-10 block h-px bg-pp-hairline" />
      <h3 className="pp-plate mt-6 text-lg text-pp-ink">How pickleball scoring works</h3>
      <p className="mt-3">
        In side-out scoring, the traditional format, only the serving team can
        score a point. A doubles score is called as three numbers: the serving
        team&apos;s score, the receiving team&apos;s score, and whether the
        current server is that team&apos;s first or second server. Both players
        on a team get a turn to serve before the serve passes to the other side,
        with an exception for the first service turn of the game. Rally scoring
        gives a point to the winner of every rally no matter who served, which
        makes games quicker and the count easier to follow. Pickle Point Pal
        keeps the call straight in either format so you can watch the court
        instead of doing the arithmetic.
      </p>

      <span className="mt-10 block h-px bg-pp-hairline" />
      <h3 className="pp-plate mt-6 text-lg text-pp-ink">Questions</h3>
      <dl className="mt-4 divide-y divide-pp-hairline border-y border-pp-hairline">
        {picklePointPalFaqs.map((faq) => (
          <div
            key={faq.question}
            className="grid gap-1.5 py-4 sm:grid-cols-[1fr_1.4fr] sm:gap-6"
          >
            <dt className="font-semibold text-pp-ink">{faq.question}</dt>
            <dd className="text-sm">{faq.answer}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-sm">
        Pickle Point Pal is one of the free{" "}
        <Link href="/tools" className="font-semibold text-pp-ink underline underline-offset-4">
          pickleball tools
        </Link>{" "}
        from Juice Bros Pickleball, a podcast for everyday players. If
        you&apos;re new to the show, the{" "}
        <Link href="/podcast" className="font-semibold text-pp-ink underline underline-offset-4">
          episodes
        </Link>{" "}
        are a good place to start.
      </p>
    </section>
  );
}
