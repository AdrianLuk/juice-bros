const pillars = [
  {
    name: "Conversations",
    blurb:
      "The psychology, the mindset, the stuff nobody else on a pickleball feed is talking about.",
  },
  {
    name: "Entertainment",
    blurb:
      "Funny stories, friendly debates, and running jokes that have gotten a little out of hand.",
  },
  {
    name: "Community",
    blurb:
      "Your stories, your clubs, your questions. Ontario and Canadian pickleball, front and center.",
  },
  {
    name: "Culture",
    blurb: "Everything around the sport: the events, the etiquette, the trends, the drama.",
  },
];

/**
 * What the show covers.
 *
 * Four equal panels on one line. The incumbent nudged every second card down
 * by 20px, which is decoration pretending to be rhythm - these are four peers
 * and reading them as a row is the whole point. Their names are ink rather
 * than the incumbent's brand orange: orange has its jobs on this site and a
 * card heading is not one of them.
 */
export function Pillars() {
  return (
    <section className="bx-measure py-16 sm:py-24">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">
        More than a podcast
      </h2>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((pillar) => (
          <li key={pillar.name} className="flex">
            <div className="bx-panel flex w-full flex-col p-6">
              <h3 className="bx-h2 text-base sm:text-lg">{pillar.name}</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
                {pillar.blurb}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
