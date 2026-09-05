import { Reveal, RevealGroup } from "@/components/motion/reveal";

const breakdowns = [
  {
    title: "You never get to play",
    body: "The rotation only exists in the volunteers' heads, so you spend the whole two hours running the floor.",
  },
  {
    title: "Court time isn't actually fair",
    body: "Nobody is tracking who has waited longest. Quiet players get passed over while the confident ones get back on again and again.",
  },
  {
    title: "The same Foursomes keep reforming",
    body: "There's no record of who has already shared a Court, so people play with the same three faces all night. That's the opposite of a social.",
  },
  {
    title: "“Am I next?” never stops",
    body: "Volunteers field that question all evening because a player has no way to check their own spot in line.",
  },
  {
    title: "Courts sit empty",
    body: "The next four get announced, but some are at the snack table or mid-mahjong, and the Court waits while they're hunted down.",
  },
];

export function TheProblem() {
  return (
    <section className="odl-section w-full">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <h2 className="odl-display text-3xl sm:text-4xl">
            The paddle stack stops working at 50 players
          </h2>
          <p className="odl-body mt-4 max-w-xl text-lg">
            Fifty or sixty people show up for a social on eight courts, and
            rotation is a physical paddle stack plus a couple of volunteers
            calling names from memory. At that size it comes apart in a few
            predictable ways.
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
