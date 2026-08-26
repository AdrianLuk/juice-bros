import { SectionHeading } from "@/components/typography/section-heading";

const pillars = [
  {
    name: "Conversations",
    blurb:
      "The psychology, the mindset, the stuff nobody else on a pickleball feed is talking about.",
  },
  {
    name: "Entertainment",
    blurb: "Funny stories, friendly debates, and running jokes that have gotten a little out of hand.",
  },
  {
    name: "Community",
    blurb: "Your stories, your clubs, your questions. Ontario and Canadian pickleball, front and center.",
  },
  {
    name: "Culture",
    blurb: "Everything around the sport: the events, the etiquette, the trends, the drama.",
  },
];

export function Pillars() {
  return (
    <section className="w-full bg-muted/50">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading title="More than a podcast" align="center" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.name}
              className={`flex flex-col gap-2 rounded-[1.5rem] bg-card p-6 shadow-brand ${index % 2 === 1 ? "lg:mt-5" : ""}`}
            >
              <p className="font-heading text-xl font-bold text-brand-orange">{pillar.name}</p>
              <p className="text-sm text-muted-foreground">{pillar.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
