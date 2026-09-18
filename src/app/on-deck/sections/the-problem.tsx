import { Reveal, RevealGroup } from "@/components/motion/reveal";

const breakdowns = [
  {
    title: "You don't get to play",
    body: "The order lives in your head and on the board in front of you, and it only stays right while you are standing next to it. The two hours you came for go to running the floor.",
  },
  {
    title: "The order is only as fair as your memory",
    body: "Nothing is counting who has waited longest. The quiet ones get passed over, and the people who come and ask get back on again.",
  },
  {
    title: "The same four keep reforming",
    body: "Nothing on the board remembers who has already shared a court, so people play the same three faces all night. That is the opposite of a social.",
  },
  {
    title: "You answer “am I next?” all evening",
    body: "A player has no way to check their own place in line except by finding you and asking.",
  },
  {
    title: "A court sits empty while you hunt four people down",
    body: "You call the names and two of them are at the snack table. The court waits, and so does everyone below them.",
  },
];

export function TheProblem() {
  return (
    <section className="odl-section w-full">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <h2 className="odl-display text-3xl sm:text-4xl">
            You have run this night with a marker in your hand
          </h2>
          <p className="odl-body mt-4 max-w-xl text-lg">
            Fifty or sixty people on eight courts, and the running order is a
            whiteboard you keep rubbing out, or a board of chips with
            everybody&apos;s name on it that somebody has to keep moving. It
            works, right up until it is the only thing you do all night.
          </p>
        </Reveal>
        <RevealGroup className="mt-10 flex flex-col gap-3">
          {breakdowns.map((item) => (
            <div key={item.title} className="odl-panel p-6">
              <p className="odl-display text-lg">{item.title}</p>
              <p className="odl-body mt-2">{item.body}</p>
            </div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
