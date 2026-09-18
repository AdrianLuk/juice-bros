import { Reveal, RevealGroup } from "@/components/motion/reveal";

/**
 * Every answer here is checked against the implementation rather than written
 * as reassurance (issue #523, user story 37). The no-internet row and the
 * limits on Undo are in deliberately: an organizer who finds either out on a
 * Saturday is an organizer who stops trusting the rest of the page.
 */

const failures = [
  {
    scenario: "The wifi keeps dropping",
    answer:
      "A screen that loses its live connection keeps asking every few seconds and picks it up again on its own. The night is a record of what happened rather than a picture a screen is holding, so a tap on a board that has fallen behind never doubles anything up.",
  },
  {
    scenario: "The gym has no internet at all",
    answer:
      "Then On Deck doesn't work. Nothing here runs offline, and you should know that before you plan a night around it.",
  },
  {
    scenario: "The tablet dies",
    answer:
      "The night isn't on the tablet. Sign in on your own phone and the board is where you left it, or use any other screen by the courts.",
  },
  {
    scenario: "You tap the wrong court done",
    answer:
      "Undo takes the last thing back for fifteen minutes, as long as nothing has happened since. Once someone else has joined or been called you put people back by hand, the same as you would on the whiteboard.",
  },
  {
    scenario: "A player arrives with a dead phone",
    answer:
      "Add them yourself, or let whoever is standing by the courts do it. First name, last initial, and they queue like everyone who scanned the sign.",
  },
  {
    scenario: "You forget to close the night",
    answer:
      "It closes itself after six quiet hours and leaves the same Session Summary any other night leaves. Next Saturday doesn't open with you fixing last Saturday.",
  },
];

export function WhenItGoesWrong() {
  return (
    <section className="odl-section w-full">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <p className="odl-mono">On a bad night</p>
          <h2 className="odl-display mt-3 text-3xl sm:text-4xl">
            Saturday, and something breaks
          </h2>
          <p className="odl-body mt-4 max-w-xl text-lg">
            You are handing your night to software in a gym with bad wifi and
            no spare tablet. Here is what it does when that goes against you.
          </p>
        </Reveal>

        <RevealGroup
          as="dl"
          className="mt-10 border-t border-[var(--odl-line-soft)]"
        >
          {failures.map((item) => (
            <div
              key={item.scenario}
              className="border-b border-[var(--odl-line-soft)] py-6 sm:grid sm:grid-cols-[15rem_1fr] sm:gap-8"
            >
              <dt className="odl-display text-lg">{item.scenario}</dt>
              <dd className="odl-body mt-2 sm:mt-0">{item.answer}</dd>
            </div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
