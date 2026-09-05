import { Reveal, RevealGroup } from "@/components/motion/reveal";

const steps = [
  {
    title: "Start the Session",
    body: "One tap from your club's saved defaults for the venue and court count. The Club QR sign is printed once and never changes, so there's nothing to set up at the door.",
  },
  {
    title: "Players add themselves",
    body: "They scan the sign, give a first name and last initial, pick a skill level from four plain words, and they're in the Queue. There's no check-in desk and nothing to install.",
  },
  {
    title: "On Deck picks who's up",
    body: "Two Foursomes are chosen and announced before any court is free, so those eight people can gather instead of being tracked down one at a time.",
  },
  {
    title: "A court frees, the next four walk on",
    body: "When a game wraps, someone taps that court done: a volunteer, or any player on the tablet by the courts. The leading On Deck Foursome takes the court, a fresh one moves up, and the players coming off re-queue on their own. Run your night with volunteers, without them, or both.",
  },
  {
    title: "Call Last Call when the night winds down",
    body: "Games in progress finish and nothing new starts. When the Session closes, the roster is deleted. You keep an anonymous Session Summary and nothing else.",
  },
];

export function HowItRuns() {
  return (
    <section id="how-it-runs" className="odl-section w-full scroll-mt-24">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <h2 className="odl-display text-3xl sm:text-4xl">
            How a night runs
          </h2>
        </Reveal>
        <RevealGroup as="ol" className="mt-10 flex flex-col gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 sm:gap-5">
              <span aria-hidden className="odl-mono odl-step-rail">
                {index + 1}
              </span>
              <div>
                <p className="odl-display text-lg">{step.title}</p>
                <p className="odl-body mt-2">{step.body}</p>
              </div>
            </li>
          ))}
        </RevealGroup>
      </div>
      <style>{`
        .odl-step-rail {
          flex: none;
          width: 2.25ch;
          padding-top: 0.35rem;
          text-align: right;
          color: var(--odl-faint);
        }
      `}</style>
    </section>
  );
}
