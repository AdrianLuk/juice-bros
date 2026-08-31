import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/typography/section-heading";

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
    <section id="how-it-runs" className="w-full scroll-mt-24">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="How It Works" title="How a night runs" />
        </Reveal>
        <RevealGroup as="ol" className="mt-10 flex flex-col gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 sm:gap-5">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange font-heading text-sm font-bold text-white"
              >
                {index + 1}
              </span>
              <div className="pt-1">
                <p className="font-heading text-lg font-bold tracking-[-0.01em]">
                  {step.title}
                </p>
                <p className="mt-2 text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
